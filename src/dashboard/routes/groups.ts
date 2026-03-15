import { Router } from 'express';

import { getDb } from '../../db.js';

export const groupsRouter = Router();

groupsRouter.get('/groups', (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT jid, name, folder, requires_trigger, is_main
       FROM registered_groups
       ORDER BY added_at
       LIMIT 100`,
    )
    .all() as Array<{
    jid: string;
    name: string;
    folder: string;
    requires_trigger: number | null;
    is_main: number | null;
  }>;

  const groups = rows.map((row) => ({
    jid: row.jid,
    name: row.name,
    folder: row.folder,
    isMain: row.is_main === 1,
    requiresTrigger: row.requires_trigger !== 0,
  }));

  res.json(groups);
});
