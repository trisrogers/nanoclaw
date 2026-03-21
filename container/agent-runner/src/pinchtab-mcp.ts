/**
 * PinchTab MCP Stdio Server
 * Wraps the PinchTab HTTP API (port 9867) as an MCP stdio server.
 * Set PINCHTAB_URL to override the default base URL.
 * Set PINCHTAB_TOKEN for bearer-token-protected instances.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.PINCHTAB_URL || 'http://host.docker.internal:9867').replace(/\/$/, '');
const TOKEN = process.env.PINCHTAB_TOKEN || '';

async function api(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  let url = `${BASE_URL}${path}`;

  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
}

/** Build path with optional instance prefix */
function p(path: string, instanceId?: string): string {
  return instanceId ? `/instances/${instanceId}${path}` : path;
}

const server = new McpServer({ name: 'pinchtab', version: '1.0.0' });

// ── Instance management ───────────────────────────────────────────────────────

server.tool('health', 'Check PinchTab server health', {
  instance_id: z.string().optional().describe('Optional instance ID for orchestrator mode'),
}, async ({ instance_id }) => {
  const data = await api('GET', p('/health', instance_id));
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('instances', 'List all running browser instances', {}, async () => {
  const data = await api('GET', '/instances');
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('instance_start', 'Launch a new browser instance. Returns instance_id for use in other tools.', {
  profile_id: z.string().optional().describe('Profile ID for persistent cookies/auth across sessions'),
  mode: z.enum(['headless', 'headed']).optional().describe('headless (default) or headed'),
  port: z.number().optional().describe('Port for the instance (orchestrator assigns one if omitted)'),
}, async ({ profile_id, mode, port }) => {
  const body: Record<string, unknown> = {};
  if (profile_id) body.profileId = profile_id;
  if (mode) body.mode = mode;
  if (port) body.port = port;
  const data = await api('POST', '/instances/start', body);
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('instance_stop', 'Stop a browser instance', {
  instance_id: z.string().describe('Instance ID to stop'),
}, async ({ instance_id }) => {
  const data = await api('POST', `/instances/${instance_id}/stop`);
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

// ── Tab / navigation ──────────────────────────────────────────────────────────

server.tool('tabs', 'List open tabs', {
  instance_id: z.string().optional().describe('Optional instance ID for orchestrator mode'),
}, async ({ instance_id }) => {
  const data = await api('GET', p('/tabs', instance_id));
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('navigate', 'Navigate to a URL', {
  url: z.string().describe('URL to navigate to'),
  instance_id: z.string().optional(),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
  block_images: z.boolean().optional().describe('Block image loading for speed'),
  new_tab: z.boolean().optional().describe('Open in a new tab'),
}, async ({ url, instance_id, timeout, block_images, new_tab }) => {
  const body: Record<string, unknown> = { url };
  if (timeout !== undefined) body.timeout = timeout;
  if (block_images !== undefined) body.blockImages = block_images;
  if (new_tab !== undefined) body.newTab = new_tab;
  const data = await api('POST', p('/navigate', instance_id), body);
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

// ── Page content ──────────────────────────────────────────────────────────────

server.tool('snapshot', 'Get a token-efficient structured snapshot of the current page (preferred over screenshot for most tasks)', {
  instance_id: z.string().optional(),
  tab_id: z.string().optional(),
  filter: z.string().optional().describe('CSS selector or role filter'),
  format: z.string().optional().describe('Output format (default: markdown)'),
  selector: z.string().optional().describe('CSS selector to scope snapshot'),
  max_tokens: z.number().optional().describe('Max output tokens'),
  diff: z.boolean().optional().describe('Return only changed elements since last snapshot'),
  depth: z.number().optional().describe('Max nesting depth'),
  no_animations: z.boolean().optional().describe('Disable CSS animations before snapshot'),
}, async ({ instance_id, tab_id, filter, format, selector, max_tokens, diff, depth, no_animations }) => {
  const query = {
    tabId: tab_id,
    filter,
    format,
    selector,
    maxTokens: max_tokens,
    diff,
    depth,
    noAnimations: no_animations,
  };
  const data = await api('GET', p('/snapshot', instance_id), undefined, query as Record<string, string | number | boolean | undefined>);
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('text', 'Extract readable text from the current page', {
  instance_id: z.string().optional(),
  tab_id: z.string().optional(),
  mode: z.enum(['readability', 'raw']).optional().describe('readability (article-focused, default) or raw'),
}, async ({ instance_id, tab_id, mode }) => {
  const data = await api('GET', p('/text', instance_id), undefined, { tabId: tab_id, mode });
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('screenshot', 'Take a screenshot of the current page', {
  instance_id: z.string().optional(),
  tab_id: z.string().optional(),
  raw: z.boolean().optional().describe('Return raw bytes instead of base64'),
  quality: z.number().optional().describe('JPEG quality 1-100'),
}, async ({ instance_id, tab_id, raw, quality }) => {
  const data = await api('GET', p('/screenshot', instance_id), undefined, { tabId: tab_id, raw, quality });
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('pdf', 'Export the current page as PDF', {
  tab_id: z.string().describe('Tab ID (required for PDF export)'),
  instance_id: z.string().optional(),
  raw: z.boolean().optional(),
  landscape: z.boolean().optional(),
  scale: z.number().optional().describe('Page scale 0.1-2.0'),
}, async ({ tab_id, instance_id, raw, landscape, scale }) => {
  const path = instance_id
    ? `/instances/${instance_id}/tabs/${tab_id}/pdf`
    : `/tabs/${tab_id}/pdf`;
  const data = await api('GET', path, undefined, { raw, landscape, scale });
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

// ── Interaction ───────────────────────────────────────────────────────────────

server.tool('action', 'Perform a single interaction on the page (click, type, scroll, etc.)', {
  kind: z.enum(['click', 'type', 'press', 'focus', 'fill', 'hover', 'select', 'scroll'])
    .describe('Action type'),
  instance_id: z.string().optional(),
  ref: z.string().optional().describe('Element reference from snapshot'),
  selector: z.string().optional().describe('CSS selector fallback'),
  key: z.string().optional().describe('Key to press (e.g. "Enter", "Tab")'),
  text: z.string().optional().describe('Text to type'),
  value: z.string().optional().describe('Value for select/fill'),
  scroll_y: z.number().optional().describe('Pixels to scroll vertically'),
  wait_nav: z.boolean().optional().describe('Wait for navigation after action'),
}, async ({ kind, instance_id, ref, selector, key, text, value, scroll_y, wait_nav }) => {
  const body: Record<string, unknown> = { kind };
  if (ref) body.ref = ref;
  if (selector) body.selector = selector;
  if (key) body.key = key;
  if (text) body.text = text;
  if (value) body.value = value;
  if (scroll_y !== undefined) body.scrollY = scroll_y;
  if (wait_nav !== undefined) body.waitNav = wait_nav;
  const data = await api('POST', p('/action', instance_id), body);
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('actions', 'Perform multiple interactions in a single request (more efficient than repeated action calls)', {
  actions: z.array(z.record(z.string(), z.unknown())).describe('Array of action objects (same shape as single action)'),
  instance_id: z.string().optional(),
  tab_id: z.string().optional(),
  stop_on_error: z.boolean().optional().describe('Stop sequence on first error (default: true)'),
}, async ({ actions, instance_id, tab_id, stop_on_error }) => {
  const body: Record<string, unknown> = { actions };
  if (tab_id) body.tabId = tab_id;
  if (stop_on_error !== undefined) body.stopOnError = stop_on_error;
  const data = await api('POST', p('/actions', instance_id), body);
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('evaluate', 'Execute JavaScript in the page context', {
  expression: z.string().describe('JavaScript expression to evaluate'),
  instance_id: z.string().optional(),
}, async ({ expression, instance_id }) => {
  const data = await api('POST', p('/evaluate', instance_id), { expression });
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

// ── Session / cookies ─────────────────────────────────────────────────────────

server.tool('cookies_get', 'Get cookies for the current session (useful for checking auth state)', {
  instance_id: z.string().optional(),
}, async ({ instance_id }) => {
  const data = await api('GET', p('/cookies', instance_id));
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

server.tool('stealth_status', 'Check whether bot-detection stealth mode is active', {
  instance_id: z.string().optional(),
}, async ({ instance_id }) => {
  const data = await api('GET', p('/stealth/status', instance_id));
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
