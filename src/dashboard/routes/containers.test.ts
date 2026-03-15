import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { DashboardDeps } from '../types.js';
import { RegisteredGroup } from '../../types.js';

const mockGroups: Record<string, RegisteredGroup> = {
  'tg:111': {
    name: 'Main Group',
    folder: 'telegram_main',
    trigger: 'deltron',
    added_at: '2024-01-01T00:00:00Z',
    isMain: true,
  },
  'tg:222': {
    name: 'Side Group',
    folder: 'side_group',
    trigger: 'deltron',
    added_at: '2024-01-01T00:00:00Z',
  },
};

const mockDeps: DashboardDeps = {
  getChannels: () => [],
  getQueueSnapshot: () => [
    {
      jid: 'tg:111',
      active: true,
      containerName: 'nanoclaw-tg-111',
      elapsedMs: 12345,
      groupFolder: 'telegram_main',
      startedAt: Date.now() - 12345,
    },
    {
      jid: 'tg:222',
      active: false,
      containerName: null,
      elapsedMs: null,
      groupFolder: 'side_group',
      startedAt: null,
    },
  ],
  getActiveContainerCount: () => 1,
  getIpcQueueDepth: () => 0,
  getTodosDueToday: () => 0,
  getLastError: () => null,
  getRegisteredGroups: () => mockGroups,
  clearGroupSession: (folder: string) => {
    if (folder === 'telegram_main' || folder === 'side_group') {
      return { ok: true };
    }
    return { ok: false, error: 'Group not found' };
  },
  restartGroupContainer: (folder: string) => {
    if (folder === 'telegram_main' || folder === 'side_group') {
      return { ok: true };
    }
    return { ok: false, error: 'Group not found' };
  },
};

describe('GET /api/containers', () => {
  it('returns 200 with array of container rows', async () => {
    const { containersRouter } = await import('./containers.js');
    const app = express();
    app.use('/api', containersRouter(mockDeps));
    const res = await supertest(app).get('/api/containers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('each row has required shape fields', async () => {
    const { containersRouter } = await import('./containers.js');
    const app = express();
    app.use('/api', containersRouter(mockDeps));
    const res = await supertest(app).get('/api/containers');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    const row = res.body[0];
    expect(typeof row.jid).toBe('string');
    expect(typeof row.active).toBe('boolean');
    expect(typeof row.groupName).toBe('string');
    // containerName can be string or null
    expect(row.elapsedMs === null || typeof row.elapsedMs === 'number').toBe(true);
  });

  it('groupName is resolved from registered groups', async () => {
    const { containersRouter } = await import('./containers.js');
    const app = express();
    app.use('/api', containersRouter(mockDeps));
    const res = await supertest(app).get('/api/containers');
    const mainRow = res.body.find((r: { jid: string }) => r.jid === 'tg:111');
    expect(mainRow.groupName).toBe('Main Group');
  });
});

describe('POST /api/containers/:folder/clear', () => {
  it('returns 200 { ok: true } for a known folder', async () => {
    const { containersRouter } = await import('./containers.js');
    const app = express();
    app.use('/api', containersRouter(mockDeps));
    const res = await supertest(app).post('/api/containers/telegram_main/clear');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 404 for an unknown folder', async () => {
    const { containersRouter } = await import('./containers.js');
    const app = express();
    app.use('/api', containersRouter(mockDeps));
    const res = await supertest(app).post('/api/containers/no_such_folder/clear');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/containers/:folder/restart', () => {
  it('returns 200 { ok: true } for a known folder', async () => {
    const { containersRouter } = await import('./containers.js');
    const app = express();
    app.use('/api', containersRouter(mockDeps));
    const res = await supertest(app).post('/api/containers/side_group/restart');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 404 for an unknown folder', async () => {
    const { containersRouter } = await import('./containers.js');
    const app = express();
    app.use('/api', containersRouter(mockDeps));
    const res = await supertest(app).post('/api/containers/ghost_folder/restart');
    expect(res.status).toBe(404);
  });
});
