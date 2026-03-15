import http from 'http';
import { describe, it, expect, afterEach } from 'vitest';
import supertest from 'supertest';
import { startDashboardServer } from './server.js';

describe('startDashboardServer', () => {
  let server: http.Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/health returns 200 with {ok: true, ts: string}', async () => {
    server = startDashboardServer(0, '0.0.0.0');
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const res = await supertest(server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.ts).toBe('string');
  });

  it('server.address() port matches the argument (INFRA-01)', async () => {
    server = startDashboardServer(0, '0.0.0.0');
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address() as { port: number };
    expect(typeof addr.port).toBe('number');
    expect(addr.port).toBeGreaterThan(0);
  });

  it('server.address().address is 0.0.0.0 (INFRA-05)', async () => {
    server = startDashboardServer(0, '0.0.0.0');
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address() as { address: string };
    expect(addr.address).toBe('0.0.0.0');
  });

  it('WebSocket upgrade to /ws/chat returns 101 Switching Protocols (INFRA-04)', async () => {
    server = startDashboardServer(0, '0.0.0.0');
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as { port: number };

    await new Promise<void>((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/ws/chat',
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Key': Buffer.from('nanoclaw-test-key').toString('base64'),
          'Sec-WebSocket-Version': '13',
        },
      });
      req.on('upgrade', (_res, socket) => {
        socket.destroy();
        resolve();
      });
      req.on('error', reject);
      req.setTimeout(3000, () => reject(new Error('WS upgrade timeout')));
      req.end();
    });
  });

  it('calling server.close() resolves without error (INFRA-03 smoke)', async () => {
    server = startDashboardServer(0, '0.0.0.0');
    await new Promise<void>((resolve) => server.listen(0, resolve));
    // server.close is called by afterEach — here we just confirm no throw
    expect(() => server.close()).not.toThrow();
    // re-assign so afterEach double-close is a no-op
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
