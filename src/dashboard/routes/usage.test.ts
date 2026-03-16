import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process before importing the module under test
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'child_process';
import { usageRouter } from './usage.js';
import type { EventEmitter } from 'events';

// Helper to create a mock child process
function makeMockProc(
  opts: { stdout?: string; stderr?: string; exitCode?: number; errorCode?: string } = {},
) {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};
  const stdoutListeners: Record<string, ((...args: any[]) => void)[]> = {};
  const stderrListeners: Record<string, ((...args: any[]) => void)[]> = {};

  const makeEmitter = (listenerMap: typeof listeners) => ({
    on: (event: string, handler: (...args: any[]) => void) => {
      listenerMap[event] = listenerMap[event] || [];
      listenerMap[event].push(handler);
    },
  });

  const proc = {
    stdout: makeEmitter(stdoutListeners),
    stderr: makeEmitter(stderrListeners),
    on: (event: string, handler: (...args: any[]) => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    _emit: (event: string, ...args: any[]) => {
      (listeners[event] || []).forEach((h) => h(...args));
    },
    _emitStdout: (data: string) => {
      (stdoutListeners['data'] || []).forEach((h) => h(Buffer.from(data)));
    },
    _emitStderr: (data: string) => {
      (stderrListeners['data'] || []).forEach((h) => h(Buffer.from(data)));
    },
    _resolve: () => {
      if (opts.stdout) {
        (stdoutListeners['data'] || []).forEach((h) =>
          h(Buffer.from(opts.stdout!)),
        );
      }
      if (opts.stderr) {
        (stderrListeners['data'] || []).forEach((h) =>
          h(Buffer.from(opts.stderr!)),
        );
      }
      if (opts.errorCode) {
        const err: any = new Error('spawn error');
        err.code = opts.errorCode;
        (listeners['error'] || []).forEach((h) => h(err));
      } else {
        (listeners['close'] || []).forEach((h) => h(opts.exitCode ?? 0));
      }
    },
  };

  return proc;
}

// Helper to invoke the /usage route handler directly
async function callUsageHandler(router: ReturnType<typeof usageRouter>) {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === '/usage' && l.route?.methods?.get,
  );
  expect(layer).toBeDefined();

  let jsonResponse: any;
  const res = {
    json: vi.fn((val: any) => {
      jsonResponse = val;
    }),
  } as any;
  const req = {} as any;

  await layer.route.stack[0].handle(req, res, vi.fn());
  return jsonResponse;
}

describe('GET /usage route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset the module-level cache between tests by re-importing
    // We'll access the router fresh each test
  });

  it('returns { data, error: null, fetchedAt } on successful spawn', async () => {
    const proc = makeMockProc({ stdout: 'Session: 100 tokens\nWeekly limit: 500', exitCode: 0 });
    vi.mocked(spawn).mockReturnValue(proc as any);

    const router = usageRouter();
    // Trigger the handler; proc resolves asynchronously
    const promise = callUsageHandler(router);
    proc._resolve();
    const result = await promise;

    expect(result.error).toBeNull();
    expect(result.fetchedAt).toBeTypeOf('number');
    expect(result.data).toBeDefined();
    expect(result.data.raw).toContain('Session');
  });

  it('does NOT re-spawn on second call within TTL (cache hit)', async () => {
    const proc1 = makeMockProc({ stdout: 'usage output', exitCode: 0 });
    vi.mocked(spawn).mockReturnValue(proc1 as any);

    // First call
    const router = usageRouter();
    const p1 = callUsageHandler(router);
    proc1._resolve();
    await p1;

    // Second call — should hit cache, spawn should still be called only once
    const p2 = callUsageHandler(router);
    await p2;

    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('returns { data: null, error: "...", fetchedAt } when CLI exits non-zero (status 200)', async () => {
    const proc = makeMockProc({ stdout: 'something failed', exitCode: 1 });
    vi.mocked(spawn).mockReturnValue(proc as any);

    const router = usageRouter();
    const promise = callUsageHandler(router);
    proc._resolve();
    const result = await promise;

    expect(result.data).toBeNull();
    expect(result.error).toBeTypeOf('string');
    expect(result.error.length).toBeGreaterThan(0);
    expect(result.fetchedAt).toBeTypeOf('number');
    // Must be 200 (json called, not status(500))
  });

  it('returns { data: null, error: "claude CLI not found in PATH" } on ENOENT', async () => {
    const proc = makeMockProc({ errorCode: 'ENOENT' });
    vi.mocked(spawn).mockReturnValue(proc as any);

    const router = usageRouter();
    const promise = callUsageHandler(router);
    proc._resolve();
    const result = await promise;

    expect(result.data).toBeNull();
    expect(result.error).toBe('claude CLI not found in PATH');
    expect(result.fetchedAt).toBeTypeOf('number');
  });

  it('returns { data: { raw: stdout }, error: null } when output cannot be structured-parsed', async () => {
    const rawOutput = 'some completely unrecognised output format';
    const proc = makeMockProc({ stdout: rawOutput, exitCode: 0 });
    vi.mocked(spawn).mockReturnValue(proc as any);

    const router = usageRouter();
    const promise = callUsageHandler(router);
    proc._resolve();
    const result = await promise;

    expect(result.error).toBeNull();
    expect(result.data.raw).toBe(rawOutput);
  });
});
