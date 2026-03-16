import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';

// Mock the db module before importing the route
vi.mock('../../db.js', () => ({
  getAllTasks: vi.fn(),
  getTaskRunLogs: vi.fn(),
}));

import { getAllTasks, getTaskRunLogs } from '../../db.js';

describe('GET /api/tasks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns array from getAllTasks', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        group_folder: 'main',
        chat_jid: 'group@g.us',
        prompt: 'daily report',
        schedule_type: 'cron',
        schedule_value: '0 9 * * 1-5',
        context_mode: 'isolated',
        next_run: '2024-01-02T09:00:00.000Z',
        last_run: '2024-01-01T09:00:00.000Z',
        last_result: 'done',
        status: 'active',
        created_at: '2024-01-01T00:00:00.000Z',
      },
    ];
    vi.mocked(getAllTasks).mockReturnValue(mockTasks as any);

    const { tasksRouter } = await import('./tasks.js');
    const app = express();
    app.use('/api', tasksRouter());
    const res = await supertest(app).get('/api/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('task-1');
    expect(res.body[0].prompt).toBe('daily report');
  });

  it('returns empty array when no tasks', async () => {
    vi.mocked(getAllTasks).mockReturnValue([]);

    const { tasksRouter } = await import('./tasks.js');
    const app = express();
    app.use('/api', tasksRouter());
    const res = await supertest(app).get('/api/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/tasks/:id/runs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns run logs from getTaskRunLogs', async () => {
    const mockLogs = [
      {
        task_id: 'task-1',
        run_at: '2024-01-01T09:00:00.000Z',
        duration_ms: 1234,
        status: 'success',
        result: 'completed',
        error: null,
      },
    ];
    vi.mocked(getTaskRunLogs).mockReturnValue(mockLogs as any);

    const { tasksRouter } = await import('./tasks.js');
    const app = express();
    app.use('/api', tasksRouter());
    const res = await supertest(app).get('/api/tasks/task-1/runs');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].duration_ms).toBe(1234);
    expect(getTaskRunLogs).toHaveBeenCalledWith('task-1');
  });

  it('returns empty array for unknown task ID', async () => {
    vi.mocked(getTaskRunLogs).mockReturnValue([]);

    const { tasksRouter } = await import('./tasks.js');
    const app = express();
    app.use('/api', tasksRouter());
    const res = await supertest(app).get('/api/tasks/nonexistent/runs');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
