import { Router } from 'express';

import { DashboardDeps } from '../types.js';

export function channelsRouter(deps: DashboardDeps): Router {
  const router = Router();
  router.get('/channels', (_req, res) => {
    const result = deps.getChannels().map((ch) => ({
      name: ch.name,
      connected: ch.isConnected(),
    }));
    res.json(result);
  });
  return router;
}
