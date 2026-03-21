/**
 * Credential proxy for container isolation.
 * Containers connect here instead of directly to the Anthropic API.
 * The proxy injects real credentials so containers never see them.
 *
 * Two auth modes:
 *   API key:  Proxy injects x-api-key on every request.
 *   OAuth:    Container CLI exchanges its placeholder token for a temp
 *             API key via /api/oauth/claude_cli/create_api_key.
 *             Proxy injects real OAuth token on that exchange request;
 *             subsequent requests carry the temp key which is valid as-is.
 */
import { createServer, Server } from 'http';
import { request as httpsRequest } from 'https';
import { request as httpRequest, RequestOptions } from 'http';

import { readEnvFile } from './env.js';
import { logger } from './logger.js';
import { logTokenUsage } from './db.js';

export type AuthMode = 'api-key' | 'oauth';

export interface ProxyConfig {
  authMode: AuthMode;
}

export function startCredentialProxy(
  port: number,
  host = '127.0.0.1',
): Promise<Server> {
  const secrets = readEnvFile([
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
  ]);

  const authMode: AuthMode = secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
  const oauthToken =
    secrets.CLAUDE_CODE_OAUTH_TOKEN || secrets.ANTHROPIC_AUTH_TOKEN;

  const upstreamUrl = new URL(
    secrets.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
  );
  const isHttps = upstreamUrl.protocol === 'https:';
  const makeRequest = isHttps ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const headers: Record<string, string | number | string[] | undefined> =
          {
            ...(req.headers as Record<string, string>),
            host: upstreamUrl.host,
            'content-length': body.length,
          };

        // Strip hop-by-hop headers that must not be forwarded by proxies
        delete headers['connection'];
        delete headers['keep-alive'];
        delete headers['transfer-encoding'];

        if (authMode === 'api-key') {
          // API key mode: inject x-api-key on every request
          delete headers['x-api-key'];
          headers['x-api-key'] = secrets.ANTHROPIC_API_KEY;
        } else {
          // OAuth mode: replace placeholder Bearer token with the real one
          // only when the container actually sends an Authorization header
          // (exchange request + auth probes). Post-exchange requests use
          // x-api-key only, so they pass through without token injection.
          if (headers['authorization']) {
            delete headers['authorization'];
            if (oauthToken) {
              headers['authorization'] = `Bearer ${oauthToken}`;
            }
          }
        }

        const groupFolder = req.headers['x-nanoclaw-group'] as
          | string
          | undefined;

        const upstream = makeRequest(
          {
            hostname: upstreamUrl.hostname,
            port: upstreamUrl.port || (isHttps ? 443 : 80),
            path: req.url,
            method: req.method,
            headers,
          } as RequestOptions,
          (upRes) => {
            res.writeHead(upRes.statusCode!, upRes.headers);
            const contentType = (upRes.headers['content-type'] as string) || '';
            const isStream = contentType.includes('text/event-stream');
            const chunks: Buffer[] = [];

            upRes.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
              res.write(chunk);
            });

            upRes.on('end', () => {
              res.end();
              // Non-blocking token usage extraction
              setImmediate(() => {
                try {
                  const body = Buffer.concat(chunks).toString('utf-8');
                  let inputTokens: number | undefined;
                  let outputTokens: number | undefined;
                  let cacheRead: number | undefined;
                  let cacheWrite: number | undefined;
                  let model: string | undefined;

                  if (isStream) {
                    // SSE: scan for usage events
                    for (const line of body.split('\n')) {
                      if (!line.startsWith('data: ')) continue;
                      try {
                        const event = JSON.parse(line.slice(6)) as Record<
                          string,
                          unknown
                        >;
                        if (event.type === 'message_start') {
                          const msg = event.message as
                            | Record<string, unknown>
                            | undefined;
                          if (msg?.model) model = String(msg.model);
                          const u = msg?.usage as
                            | Record<string, number>
                            | undefined;
                          if (u) {
                            inputTokens = u.input_tokens;
                            cacheRead = u.cache_read_input_tokens;
                            cacheWrite = u.cache_write_input_tokens;
                          }
                        } else if (event.type === 'message_delta') {
                          const u = event.usage as
                            | Record<string, number>
                            | undefined;
                          if (u) outputTokens = u.output_tokens;
                        }
                      } catch {
                        /* skip non-JSON SSE lines */
                      }
                    }
                  } else {
                    const json = JSON.parse(body) as Record<string, unknown>;
                    const u = json.usage as Record<string, number> | undefined;
                    if (u?.input_tokens !== undefined) {
                      inputTokens = u.input_tokens;
                      outputTokens = u.output_tokens;
                      cacheRead = u.cache_read_input_tokens;
                      cacheWrite = u.cache_write_input_tokens;
                      model = json.model as string | undefined;
                    }
                  }

                  if (inputTokens !== undefined) {
                    logTokenUsage({
                      group_folder: groupFolder ?? null,
                      model: model ?? null,
                      input_tokens: inputTokens,
                      output_tokens: outputTokens ?? 0,
                      cache_read_tokens: cacheRead ?? 0,
                      cache_write_tokens: cacheWrite ?? 0,
                    });
                  }
                } catch {
                  /* ignore parse errors */
                }
              });
            });
          },
        );

        upstream.on('error', (err) => {
          logger.error(
            { err, url: req.url },
            'Credential proxy upstream error',
          );
          if (!res.headersSent) {
            res.writeHead(502);
            res.end('Bad Gateway');
          }
        });

        upstream.write(body);
        upstream.end();
      });
    });

    server.listen(port, host, () => {
      logger.info({ port, host, authMode }, 'Credential proxy started');
      resolve(server);
    });

    server.on('error', reject);
  });
}

/** Detect which auth mode the host is configured for. */
export function detectAuthMode(): AuthMode {
  const secrets = readEnvFile(['ANTHROPIC_API_KEY']);
  return secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
}
