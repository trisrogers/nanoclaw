import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';

// Mock ../../todo.js before importing the route
vi.mock('../../todo.js', () => ({
  listTodos: vi.fn(),
  listProjects: vi.fn(),
}));

const mockItems = [
  {
    task_id: 'TSK-001',
    seq_num: 1,
    title: 'First task',
    assignee: 'tristan',
    status: 'open',
    project_code: 'TSK',
    priority: 'high',
    due_date: '2026-03-20',
    reminder_at: null,
    reminder_sent: 0,
    tags: null,
    notes: null,
    notion_id: null,
    parent_task_id: null,
    subtask_letter: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    task_id: 'TSK-002',
    seq_num: 2,
    title: 'Done task',
    assignee: 'deltron',
    status: 'done',
    project_code: 'TSK',
    priority: null,
    due_date: null,
    reminder_at: null,
    reminder_sent: 0,
    tags: null,
    notes: null,
    notion_id: null,
    parent_task_id: null,
    subtask_letter: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-02T00:00:00Z',
  },
  {
    task_id: 'TSK-003',
    seq_num: 3,
    title: 'Cancelled task',
    assignee: 'tristan',
    status: 'cancelled',
    project_code: 'TSK',
    priority: null,
    due_date: null,
    reminder_at: null,
    reminder_sent: 0,
    tags: null,
    notes: null,
    notion_id: null,
    parent_task_id: null,
    subtask_letter: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-03T00:00:00Z',
  },
];

const mockProjects = [
  { code: 'TSK', name: 'Tasks', created_at: '2026-03-01T00:00:00Z' },
  { code: 'PFR', name: 'Performance', created_at: '2026-03-01T00:00:00Z' },
];

describe('GET /api/todos', () => {
  beforeEach(async () => {
    const todo = await import('../../todo.js');
    vi.mocked(todo.listTodos).mockReturnValue(
      mockItems as ReturnType<typeof todo.listTodos>,
    );
    vi.mocked(todo.listProjects).mockReturnValue(mockProjects);
  });

  it('returns 200 with { items, projects }', async () => {
    const { todosRouter } = await import('./todos.js');
    const app = express();
    app.use('/api', todosRouter());
    const res = await supertest(app).get('/api/todos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(Array.isArray(res.body.projects)).toBe(true);
  });

  it('returns all items regardless of status', async () => {
    const { todosRouter } = await import('./todos.js');
    const app = express();
    app.use('/api', todosRouter());
    const res = await supertest(app).get('/api/todos');
    expect(res.body.items).toHaveLength(3);
    const statuses = res.body.items.map((i: { status: string }) => i.status);
    expect(statuses).toContain('open');
    expect(statuses).toContain('done');
    expect(statuses).toContain('cancelled');
  });

  it('returns correct projects', async () => {
    const { todosRouter } = await import('./todos.js');
    const app = express();
    app.use('/api', todosRouter());
    const res = await supertest(app).get('/api/todos');
    expect(res.body.projects).toHaveLength(2);
    expect(res.body.projects[0].code).toBe('TSK');
    expect(res.body.projects[1].code).toBe('PFR');
  });
});
