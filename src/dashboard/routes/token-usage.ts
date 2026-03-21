import { Router } from 'express';

import { getTokenUsageSummary } from '../../db.js';

export function tokenUsageRouter(): Router {
  const router = Router();

  router.get('/token-usage', (_req, res) => {
    try {
      res.json(getTokenUsageSummary());
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
