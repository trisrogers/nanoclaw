import { Router } from 'express';
import express from 'express';

import {
  listTodos,
  listProjects,
  completeTodo,
  updateTodo,
  createTodo,
  getTodo,
  getOrCreateProject,
} from '../../todo.js';
import { deleteTodo } from '../../db.js';

export function todosRouter(): Router {
  const router = Router();

  router.use(express.json());

  router.get('/todos', (_req, res) => {
    const items = listTodos();
    const projects = listProjects();
    res.json({ items, projects });
  });

  router.post('/projects', (req, res) => {
    const { code, name } = req.body as { code?: string; name?: string };

    if (!code || !name) {
      res.status(400).json({ error: 'code and name required' });
      return;
    }

    const codeUpper = code.toUpperCase();
    if (codeUpper.length < 1 || codeUpper.length > 3) {
      res.status(400).json({ error: 'code must be 1-3 characters' });
      return;
    }

    try {
      const project = getOrCreateProject(codeUpper, name);
      res.json({
        code: project.code,
        name: project.name,
        createdAt: project.created_at,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/todos', (req, res) => {
    const { title, assignee, projectCode, priority, dueDate, notes } =
      req.body as {
        title?: string;
        assignee?: string;
        projectCode?: string;
        priority?: string;
        dueDate?: string;
        notes?: string;
      };

    if (!title || !assignee) {
      res.status(400).json({ error: 'title and assignee required' });
      return;
    }
    if (!['tristan', 'deltron'].includes(assignee)) {
      res.status(400).json({ error: 'assignee must be tristan or deltron' });
      return;
    }

    try {
      const item = createTodo({
        title,
        assignee: assignee as 'tristan' | 'deltron',
        projectCode: projectCode || 'TSK',
        priority: priority as 'low' | 'medium' | 'high' | undefined,
        dueDate,
        notes,
      });
      res.json(item);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.put('/todos/:id', (req, res) => {
    const { id } = req.params;
    const todo = getTodo(id);
    if (!todo) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    const { title, assignee, status, priority, dueDate, notes } = req.body as {
      title?: string;
      assignee?: string;
      status?: string;
      priority?: string;
      dueDate?: string | null;
      notes?: string | null;
    };

    try {
      if (status === 'done') {
        completeTodo(id);
      }
      updateTodo(id, {
        title,
        assignee: assignee as 'tristan' | 'deltron' | undefined,
        status: status as 'open' | 'done' | 'cancelled' | undefined,
        priority: priority as 'low' | 'medium' | 'high' | null | undefined,
        dueDate,
        notes,
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.patch('/todos/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body as { status?: string };
    if (!status || !['open', 'done', 'cancelled'].includes(status)) {
      res
        .status(400)
        .json({ error: 'status must be open, done, or cancelled' });
      return;
    }
    try {
      if (status === 'done') {
        completeTodo(id);
      } else {
        updateTodo(id, { status: status as 'open' | 'cancelled' });
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.delete('/todos/:id', (req, res) => {
    try {
      deleteTodo(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return router;
}
