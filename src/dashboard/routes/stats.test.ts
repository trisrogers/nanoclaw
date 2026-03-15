import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { DashboardDeps } from '../types.js';

// Minimal mock deps
const mockDeps: DashboardDeps = {
  getChannels: () => [],
  getQueueSnapshot: () => [],
  getActiveContainerCount: () => 2,
  getIpcQueueDepth: () => 5,
  getTodosDueToday: () => 3,
  getLastError: () => 'Something went wrong',
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
  } as unknown as import('../../channels/web-dashboard.js').WebDashboardChannel,
  storeMessage: () => {},
  enqueueMessageCheck: () => {},
};

describe('GET /api/stats', () => {
  it('returns 200 with correct shape', async () => {
    // statsRouter does not exist yet — this import will fail until Task 2
    const { statsRouter } = await import('./stats.js');
    const app = express();
    app.use('/api', statsRouter(mockDeps));
    const res = await supertest(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.channelsConnected).toBe('number');
    expect(typeof res.body.activeContainers).toBe('number');
    expect(typeof res.body.ipcQueueDepth).toBe('number');
    expect(typeof res.body.todosDueToday).toBe('number');
    expect(
      res.body.lastError === null || typeof res.body.lastError === 'string',
    ).toBe(true);
  });

  it('activeContainers reflects mock value', async () => {
    const { statsRouter } = await import('./stats.js');
    const app = express();
    app.use('/api', statsRouter(mockDeps));
    const res = await supertest(app).get('/api/stats');
    expect(res.body.activeContainers).toBe(2);
    expect(res.body.ipcQueueDepth).toBe(5);
    expect(res.body.todosDueToday).toBe(3);
    expect(res.body.lastError).toBe('Something went wrong');
  });
});
