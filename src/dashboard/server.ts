import http from 'http';
import path from 'path';

import express from 'express';
import { WebSocketServer } from 'ws';

import { logger } from '../logger.js';
import { groupsRouter } from './routes/groups.js';

/**
 * Create and start the dashboard HTTP + WebSocket server.
 *
 * Route order: API routes → static files → SPA catch-all.
 * The caller owns the shutdown lifecycle — do NOT add SIGTERM handlers here.
 *
 * @param port     TCP port to listen on (default 3030 via config)
 * @param bindHost Host address to bind (default '0.0.0.0')
 * @returns        The underlying http.Server so callers can call .close()
 */
export function startDashboardServer(
  port: number,
  bindHost: string,
): http.Server {
  if (bindHost === '0.0.0.0') {
    logger.warn(
      'Dashboard bound to 0.0.0.0 — accessible on all network interfaces',
    );
  }

  const app = express();

  // ── API routes ─────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.use('/api', groupsRouter);

  // ── Static files (built dashboard) ─────────────────────────────────────────
  const distPath = path.resolve(process.cwd(), 'dashboard', 'dist');
  app.use(express.static(distPath));

  // ── SPA catch-all (must come last) ─────────────────────────────────────────
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // ── HTTP server ─────────────────────────────────────────────────────────────
  const server = http.createServer(app);

  // ── WebSocket server attached to /ws/chat ───────────────────────────────────
  const wss = new WebSocketServer({ server, path: '/ws/chat' });
  wss.on('connection', (ws) => {
    logger.debug('Dashboard WebSocket client connected');
    ws.on('close', () =>
      logger.debug('Dashboard WebSocket client disconnected'),
    );
  });

  server.listen(port, bindHost, () => {
    const addr = server.address() as { address: string; port: number };
    logger.info(
      { address: addr.address, port: addr.port },
      'Dashboard listening on %s:%d',
      addr.address,
      addr.port,
    );
  });

  return server;
}
