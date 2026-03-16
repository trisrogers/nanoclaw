import { Router } from 'express';

import { getAllTasks, getTaskRunLogs } from '../../db.js';

export function tasksRouter(): Router {
  const router = Router();

  router.get('/tasks', (_req, res) => {
    res.json(getAllTasks());
  });

  router.get('/tasks/:id/runs', (req, res) => {
    res.json(getTaskRunLogs(req.params.id));
  });

  return router;
}
