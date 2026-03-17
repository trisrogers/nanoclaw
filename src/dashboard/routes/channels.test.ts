import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { DashboardDeps } from '../types.js';
import { Channel } from '../../types.js';

// Mock channel
const mockChannel: Channel = {
  name: 'telegram',
  connect: async () => {},
  sendMessage: async () => {},
  isConnected: () => true,
  ownsJid: () => false,
  disconnect: async () => {},
};

const mockDeps: DashboardDeps = {
  getChannels: () => [mockChannel],
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
  } as unknown as import('../../channels/web-dashboard.js').WebDashboardChannel,
  storeMessage: () => {},
  enqueueMessageCheck: () => {},
};

describe('GET /api/channels', () => {
  it('returns 200 with array of { name, connected }', async () => {
    // channelsRouter does not exist yet — this import will fail until Task 2
    const { channelsRouter } = await import('./channels.js');
    const app = express();
    app.use('/api', channelsRouter(mockDeps));
    const res = await supertest(app).get('/api/channels');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('telegram');
    expect(res.body[0].connected).toBe(true);
  });

  it('returns empty array when no channels', async () => {
    const { channelsRouter } = await import('./channels.js');
    const emptyDeps: DashboardDeps = { ...mockDeps, getChannels: () => [] };
    const app = express();
    app.use('/api', channelsRouter(emptyDeps));
    const res = await supertest(app).get('/api/channels');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
