import { Router } from 'express';

import { DashboardDeps } from '../types.js';

export function statsRouter(deps: DashboardDeps): Router {
  const router = Router();
  router.get('/stats', (_req, res) => {
    res.json({
      channelsConnected: deps.getChannels().filter((ch) => ch.isConnected()).length,
      activeContainers: deps.getActiveContainerCount(),
      ipcQueueDepth: deps.getIpcQueueDepth(),
      todosDueToday: deps.getTodosDueToday(),
      lastError: deps.getLastError(),
    });
  });
  return router;
}
