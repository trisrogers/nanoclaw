import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';

// Mock fs and db BEFORE importing the module under test
vi.mock('fs');
vi.mock('../../db.js', () => ({
  getAllRegisteredGroups: vi.fn(),
}));

import fs from 'fs';
import { getAllRegisteredGroups } from '../../db.js';
import { memoryRouter } from './memory.js';

const mockGroups = {
  'tg:1234': { name: 'Main', folder: 'telegram_main', trigger: '!', added_at: '2024-01-01', isMain: true },
};

function makeApp() {
  const app = express();
  app.use('/api', memoryRouter());
  return app;
}

describe('GET /api/memory/:group', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAllRegisteredGroups).mockReturnValue(mockGroups as any);
  });

  it('returns content for global group', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('# Global CLAUDE.md content');

    const res = await supertest(makeApp()).get('/api/memory/global');
    expect(res.status).toBe(200);
    expect(res.body.group).toBe('global');
    expect(res.body.content).toBe('# Global CLAUDE.md content');
  });

  it('returns content for a registered group folder', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('# Telegram CLAUDE.md');

    const res = await supertest(makeApp()).get('/api/memory/telegram_main');
    expect(res.status).toBe(200);
    expect(res.body.group).toBe('telegram_main');
    expect(res.body.content).toBe('# Telegram CLAUDE.md');
  });

  it('returns 404 for unknown group', async () => {
    const res = await supertest(makeApp()).get('/api/memory/unknown_group');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('unknown group');
  });

  it('returns 404 for path traversal attempt', async () => {
    const res = await supertest(makeApp()).get('/api/memory/..%2F..%2Fetc%2Fpasswd');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('unknown group');
  });

  it('returns empty string content when CLAUDE.md does not exist (not 404)', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });

    const res = await supertest(makeApp()).get('/api/memory/global');
    expect(res.status).toBe(200);
    expect(res.body.group).toBe('global');
    expect(res.body.content).toBe('');
  });
});

describe('PUT /api/memory/:group', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAllRegisteredGroups).mockReturnValue(mockGroups as any);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  it('writes content and returns ok for global group', async () => {
    const res = await supertest(makeApp())
      .put('/api/memory/global')
      .send({ content: '# Updated global' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('returns 404 for unknown group', async () => {
    const res = await supertest(makeApp())
      .put('/api/memory/unknown_group')
      .send({ content: 'hello' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('unknown group');
  });

  it('returns 400 when content is not a string', async () => {
    const res = await supertest(makeApp())
      .put('/api/memory/global')
      .send({ content: 42 })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('content must be a string');
  });
});
