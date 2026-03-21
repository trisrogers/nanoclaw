import { randomUUID } from 'crypto';

import express, { Router } from 'express';

import { getMessagesByGroup } from '../../db.js';
import { routeOutbound } from '../../router.js';
import { DashboardDeps } from '../types.js';

export function messagesRouter(deps: DashboardDeps): Router {
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

  router.post('/messages/send', express.json(), async (req, res) => {
    const { jid, text } = req.body as { jid?: string; text?: string };
    if (!jid || !text) {
      res.status(400).json({ error: 'jid and text required' });
      return;
    }
    const groups = deps.getRegisteredGroups();
    if (!groups[jid]) {
      res.status(404).json({ error: 'Unknown group' });
      return;
    }
    try {
      const channels = deps.getChannels();
      await routeOutbound(channels, jid, text);
      deps.storeMessage({
        id: randomUUID(),
        chat_jid: jid,
        sender: 'dashboard',
        sender_name: 'You',
        content: text,
        timestamp: new Date().toISOString(),
        is_from_me: true,
        is_bot_message: false,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
