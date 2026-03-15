import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs module before importing the module under test
vi.mock('fs');

import fs from 'fs';
import { parseLogLines, logsRouter } from './logs.js';

// ── Unit tests for parseLogLines ──────────────────────────────────────────────

describe('parseLogLines', () => {
  it('happy path: parses 3 log entries with correct fields', () => {
    const lines = [
      '[21:53:14.834] INFO (68834): Database initialized',
      '[21:53:15.001] ERROR (68834): Connection failed',
      '[21:53:15.200] WARN (68834): Retrying connection',
    ];
    const entries = parseLogLines(lines);
    expect(entries).toHaveLength(3);

    expect(entries[0]).toMatchObject({
      timestamp: '21:53:14.834',
      level: 'info',
      message: 'Database initialized',
    });
    expect(entries[1]).toMatchObject({
      timestamp: '21:53:15.001',
      level: 'error',
      message: 'Connection failed',
    });
    expect(entries[2]).toMatchObject({
      timestamp: '21:53:15.200',
      level: 'warn',
      message: 'Retrying connection',
    });
  });

  it('strips ANSI escape codes from output', () => {
    const lines = [
      '\x1B[32m[21:53:14.834]\x1B[0m \x1B[36mINFO\x1B[0m (68834): Database \x1B[1minitialized\x1B[0m',
    ];
    const entries = parseLogLines(lines);
    expect(entries).toHaveLength(1);
    expect(entries[0].timestamp).toBe('21:53:14.834');
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('Database initialized');
    expect(entries[0].raw).not.toMatch(/\x1B/);
  });

  it('appends continuation lines to the preceding entry message', () => {
    const lines = [
      '[21:53:15.001] ERROR (68834): Connection failed',
      '    error: ECONNREFUSED',
      '    at connect (net.js:1)',
    ];
    const entries = parseLogLines(lines);
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toContain('Connection failed');
    expect(entries[0].message).toContain('error: ECONNREFUSED');
    expect(entries[0].message).toContain('at connect (net.js:1)');
  });

  it('returns empty array for empty input', () => {
    expect(parseLogLines([])).toEqual([]);
  });
});

// ── Integration tests for logsRouter ─────────────────────────────────────────

describe('GET /logs route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty array when log file does not exist', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });

    const router = logsRouter();
    const req = {} as any;
    let jsonResponse: any;
    const res = {
      json: vi.fn((val) => { jsonResponse = val; }),
    } as any;

    // Find the GET /logs handler
    const layer = (router as any).stack.find(
      (l: any) => l.route?.path === '/logs' && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
    await layer.route.stack[0].handle(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith([]);
    expect(jsonResponse).toEqual([]);
  });

  it('returns parsed entries from log file', async () => {
    const mockContent = [
      '[21:53:14.834] INFO (68834): Database initialized',
      '[21:53:15.001] ERROR (68834): Connection failed',
    ].join('\n');

    vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

    const router = logsRouter();
    const req = {} as any;
    let jsonResponse: any;
    const res = {
      json: vi.fn((val) => { jsonResponse = val; }),
    } as any;

    const layer = (router as any).stack.find(
      (l: any) => l.route?.path === '/logs' && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
    await layer.route.stack[0].handle(req, res, vi.fn());

    expect(Array.isArray(jsonResponse)).toBe(true);
    expect(jsonResponse).toHaveLength(2);
    expect(jsonResponse[0].level).toBe('info');
    expect(jsonResponse[1].level).toBe('error');
  });
});
