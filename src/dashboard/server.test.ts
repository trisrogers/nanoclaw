import http from 'http';
import { WebSocket } from 'ws';
import { describe, it, expect, afterEach } from 'vitest';
import supertest from 'supertest';
import { startDashboardServer } from './server.js';
import { DashboardDeps } from './types.js';

/** Minimal mock DashboardDeps for tests that don't exercise route behaviour */
const mockDeps: DashboardDeps = {
  getChannels: () => [],
  getQueueSnapshot: () => [],
  getActiveContainerCount: () => 0,
  getIpcQueueDepth: () => 0,
  getTodosDueToday: () => 0,
  getLastError: () => null,
  getRegisteredGroups: () => ({}),
  clearGroupSession: () => ({ ok: true }),
  restartGroupContainer: () => ({ ok: true }),
  webDashboardChannel: {
    addClient: () => {},
    removeClient: () => {},
    getClientCount: () => 0,
    name: 'web-dashboard',
    connect: async () => {},
    sendMessage: async () => {},
    isConnected: () => true,
    ownsJid: (jid: string) => jid === 'web:dashboard',
    disconnect: async () => {},
    setTyping: async () => {},
  } as unknown as import('../channels/web-dashboard.js').WebDashboardChannel,
  storeMessage: () => {},
  enqueueMessageCheck: () => {},
};

/** Wait for the server to start listening (in case listen is async). */
function waitListening(server: http.Server): Promise<void> {
  if (server.listening) return Promise.resolve();
  return new Promise((resolve) => server.once('listening', resolve));
}

describe('startDashboardServer', () => {
  let server: http.Server;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/health returns 200 with {ok: true, ts: string}', async () => {
    server = startDashboardServer(0, '0.0.0.0', mockDeps);
    await waitListening(server);
    const res = await supertest(server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.ts).toBe('string');
  });

  it('server.address() port matches the argument (INFRA-01)', async () => {
    server = startDashboardServer(0, '0.0.0.0', mockDeps);
    await waitListening(server);
    const addr = server.address() as { port: number };
    expect(typeof addr.port).toBe('number');
    expect(addr.port).toBeGreaterThan(0);
  });

  it('server binds to all interfaces — address is 0.0.0.0 or :: (INFRA-05)', async () => {
    server = startDashboardServer(0, '0.0.0.0', mockDeps);
    await waitListening(server);
    const addr = server.address() as { address: string };
    // Node may report '0.0.0.0' (IPv4 only) or '::' (IPv6 dual-stack) when
    // bindHost is '0.0.0.0' — both mean "all interfaces".
    expect(['0.0.0.0', '::']).toContain(addr.address);
  });

  it('WebSocket upgrade to /ws/chat returns 101 Switching Protocols (INFRA-04)', async () => {
    server = startDashboardServer(0, '0.0.0.0', mockDeps);
    await waitListening(server);
    const { port } = server.address() as { port: number };

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`);
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      ws.on('error', reject);
    });
  }, 8000);

  it('calling server.close() resolves without error (INFRA-03 smoke)', async () => {
    server = startDashboardServer(0, '0.0.0.0', mockDeps);
    await waitListening(server);
    // Close the server and confirm it resolves
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
