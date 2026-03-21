import fs from 'fs';
import path from 'path';

import express, { Router } from 'express';

import { getAllRegisteredGroups } from '../../db.js';

const PROJECT_ROOT = path.resolve(process.cwd());

function resolveMemoryPath(group: string): string | null {
  const GROUPS_DIR = path.resolve(PROJECT_ROOT, 'groups');
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

/** Scan for all editable .md files within allowed directories. */
function listEditableFiles(): Array<{
  label: string;
  path: string;
  category: string;
}> {
  const files: Array<{ label: string; path: string; category: string }> = [];

  // Root CLAUDE.md
  const rootClaude = path.join(PROJECT_ROOT, 'CLAUDE.md');
  if (fs.existsSync(rootClaude)) {
    files.push({ label: 'CLAUDE.md', path: 'CLAUDE.md', category: 'Root' });
  }

  // docs/*.md
  const docsDir = path.join(PROJECT_ROOT, 'docs');
  if (fs.existsSync(docsDir)) {
    for (const f of fs.readdirSync(docsDir)) {
      if (f.endsWith('.md')) {
        files.push({ label: `docs/${f}`, path: `docs/${f}`, category: 'Docs' });
      }
    }
  }

  // groups/*/CLAUDE.md
  const groupsDir = path.join(PROJECT_ROOT, 'groups');
  if (fs.existsSync(groupsDir)) {
    for (const folder of fs.readdirSync(groupsDir)) {
      const claudeFile = path.join(groupsDir, folder, 'CLAUDE.md');
      if (fs.existsSync(claudeFile)) {
        files.push({
          label: `groups/${folder}/CLAUDE.md`,
          path: `groups/${folder}/CLAUDE.md`,
          category: 'Group Memories',
        });
      }
    }
  }

  return files;
}

/** Validate a relative path is within allowed set (no traversal). */
function resolveFilePath(relPath: string): string | null {
  // Reject any path with traversal sequences
  if (relPath.includes('..') || path.isAbsolute(relPath)) return null;
  const abs = path.resolve(PROJECT_ROOT, relPath);
  // Must stay within project root
  if (!abs.startsWith(PROJECT_ROOT + path.sep) && abs !== PROJECT_ROOT)
    return null;
  // Must be an allowed .md file
  if (!relPath.endsWith('.md')) return null;
  // Must be within groups/, docs/, or at root
  const allowed =
    relPath.startsWith('groups/') ||
    relPath.startsWith('docs/') ||
    relPath === 'CLAUDE.md';
  if (!allowed) return null;
  return abs;
}

export function memoryRouter(): Router {
  const router = Router();

  // ── Existing /memory/:group endpoints (backward compat) ────────────────────

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

  // ── New /files endpoints for arbitrary .md editing ─────────────────────────

  router.get('/files', (_req, res) => {
    res.json(listEditableFiles());
  });

  router.get('/files/content', (req, res) => {
    const relPath = req.query.path as string | undefined;
    if (!relPath) {
      res.status(400).json({ error: 'path required' });
      return;
    }
    const abs = resolveFilePath(relPath);
    if (!abs) {
      res.status(403).json({ error: 'Path not allowed' });
      return;
    }
    let content = '';
    try {
      content = fs.readFileSync(abs, 'utf-8');
    } catch {
      /* missing — return empty */
    }
    res.json({ path: relPath, content });
  });

  router.put('/files/content', express.json({ limit: '1mb' }), (req, res) => {
    const relPath = req.query.path as string | undefined;
    if (!relPath) {
      res.status(400).json({ error: 'path required' });
      return;
    }
    const abs = resolveFilePath(relPath);
    if (!abs) {
      res.status(403).json({ error: 'Path not allowed' });
      return;
    }
    const { content } = req.body as { content?: unknown };
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'content must be a string' });
      return;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
    res.json({ ok: true });
  });

  return router;
}
