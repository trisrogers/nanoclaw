import fs from 'fs';
import path from 'path';

import express, { Router } from 'express';

import { getAllRegisteredGroups } from '../../db.js';

function resolveMemoryPath(group: string): string | null {
  const GROUPS_DIR = path.resolve(process.cwd(), 'groups');
  if (group === 'global') {
    return path.join(GROUPS_DIR, 'global', 'CLAUDE.md');
  }
  const registered = getAllRegisteredGroups();
  const knownFolders = Object.values(registered).map((g) => g.folder);
  if (!knownFolders.includes(group)) return null;
  const resolved = path.resolve(GROUPS_DIR, group, 'CLAUDE.md');
  if (!resolved.startsWith(GROUPS_DIR + path.sep)) return null;
  return resolved;
}

export function memoryRouter(): Router {
  const router = Router();

  router.get('/memory/:group', (req, res) => {
    const filePath = resolveMemoryPath(req.params.group);
    if (!filePath) {
      res.status(404).json({ error: 'unknown group' });
      return;
    }
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      /* file missing — return empty string, not 404 */
    }
    res.json({ group: req.params.group, content });
  });

  router.put('/memory/:group', express.json({ limit: '1mb' }), (req, res) => {
    const filePath = resolveMemoryPath(req.params.group);
    if (!filePath) {
      res.status(404).json({ error: 'unknown group' });
      return;
    }
    const { content } = req.body as { content?: unknown };
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'content must be a string' });
      return;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ ok: true });
  });

  return router;
}
