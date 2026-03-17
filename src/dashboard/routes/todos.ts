import { Router } from 'express';
import express from 'express';

import { listTodos, listProjects, completeTodo, updateTodo } from '../../todo.js';

export function todosRouter(): Router {
  const router = Router();

  router.use(express.json());

  router.get('/todos', (_req, res) => {
    const items = listTodos();
    const projects = listProjects();
    res.json({ items, projects });
  });

  router.patch('/todos/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body as { status?: string };
    if (!status || !['open', 'done', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'status must be open, done, or cancelled' });
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

  return router;
}
