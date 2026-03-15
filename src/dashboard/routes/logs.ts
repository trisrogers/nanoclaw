import fs from 'fs';
import path from 'path';

import { Router } from 'express';

const ANSI = /\x1B\[[0-9;]*m/g;
const HEADER = /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s+(\w+)\s+\(\d+\):\s+(.*)/;
const LOG_LINE_COUNT = 200;

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

export function parseLogLines(rawLines: string[]): LogEntry[] {
  const entries: LogEntry[] = [];
  let current: LogEntry | null = null;

  for (const rawLine of rawLines) {
    const line = rawLine.replace(ANSI, '').trimEnd();
    const m = line.match(HEADER);
    if (m) {
      if (current) entries.push(current);
      current = {
        timestamp: m[1],
        level: m[2].toLowerCase(),
        message: m[3],
        raw: line,
      };
    } else if (current && line.trim()) {
      current.message += ' ' + line.trim();
      current.raw += '\n' + line;
    }
  }
  if (current) entries.push(current);
  return entries;
}

export function logsRouter(): Router {
  const router = Router();
  const logFilePath = path.join(process.cwd(), 'logs', 'nanoclaw.log');

  router.get('/logs', (_req, res) => {
    try {
      const content = fs.readFileSync(logFilePath, 'utf-8');
      // Grab extra lines to account for continuation lines
      const rawLines = content.split('\n').filter(Boolean).slice(-LOG_LINE_COUNT * 3);
      const entries = parseLogLines(rawLines).slice(-LOG_LINE_COUNT);
      res.json(entries);
    } catch {
      // File missing or unreadable — return empty array, not error
      res.json([]);
    }
  });

  return router;
}
