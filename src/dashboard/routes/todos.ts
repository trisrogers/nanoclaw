import { Router } from 'express';

import { listTodos, listProjects } from '../../todo.js';

export function todosRouter(): Router {
  const router = Router();
  router.get('/todos', (_req, res) => {
    const items = listTodos();
    const projects = listProjects();
    res.json({ items, projects });
  });
  return router;
}
