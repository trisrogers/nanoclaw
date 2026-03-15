import { Router } from 'express';

import { DashboardDeps } from '../types.js';

export function containersRouter(deps: DashboardDeps): Router {
  const router = Router();

  router.get('/containers', (_req, res) => {
    const snapshot = deps.getQueueSnapshot();
    const groups = deps.getRegisteredGroups();
    const result = snapshot.map((s) => ({
      ...s,
      groupName: s.groupFolder
        ? (Object.values(groups).find((g) => g.folder === s.groupFolder)
            ?.name ?? s.groupFolder)
        : s.jid,
    }));
    res.json(result);
  });

  router.post('/containers/:folder/clear', (req, res) => {
    const { folder } = req.params;
    const groups = deps.getRegisteredGroups();
    const exists = Object.values(groups).some((g) => g.folder === folder);
    if (!exists) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    const result = deps.clearGroupSession(folder);
    if (!result.ok) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  router.post('/containers/:folder/restart', (req, res) => {
    const { folder } = req.params;
    const groups = deps.getRegisteredGroups();
    const exists = Object.values(groups).some((g) => g.folder === folder);
    if (!exists) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    const result = deps.restartGroupContainer(folder);
    if (!result.ok) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
