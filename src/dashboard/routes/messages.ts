import { Router } from 'express';

import { getMessagesByGroup } from '../../db.js';

export function messagesRouter(): Router {
  const router = Router();

  router.get('/messages', (req, res) => {
    const { group, page = '1', search } = req.query as Record<string, string>;
    if (!group) {
      res.status(400).json({ error: 'group required' });
      return;
    }
    const pageNum = Math.max(1, parseInt(page) || 1);
    const { messages, total } = getMessagesByGroup(
      group,
      pageNum,
      search || undefined,
    );
    const pages = Math.max(1, Math.ceil(total / 50));
    res.json({ messages, total, page: pageNum, pages });
  });

  return router;
}
