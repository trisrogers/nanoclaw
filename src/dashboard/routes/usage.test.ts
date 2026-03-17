import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({ readFile: vi.fn() }));

import { readFile } from 'fs/promises';
import { usageRouter } from './usage.js';

const MOCK_CREDENTIALS = JSON.stringify({
  claudeAiOauth: { accessToken: 'test-token-123' },
});

const MOCK_USAGE = {
  five_hour: { utilization: 42, resets_at: '2026-03-16T06:00:00+00:00' },
  seven_day: { utilization: 71, resets_at: '2026-03-20T09:00:00+00:00' },
  extra_usage: {
    is_enabled: true,
    monthly_limit: 2000,
    used_credits: 2003,
    utilization: 100,
  },
};

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
  await layer.route.stack[0].handle({} as any, res, vi.fn());
  return jsonResponse;
}

describe('GET /usage route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readFile).mockResolvedValue(MOCK_CREDENTIALS as any);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(MOCK_USAGE),
    }) as any;
  });

  it('returns { data, error: null, fetchedAt } on success', async () => {
    const result = await callUsageHandler(usageRouter());
    expect(result.error).toBeNull();
    expect(result.fetchedAt).toBeTypeOf('number');
    expect(result.data.five_hour.utilization).toBe(42);
    expect(result.data.seven_day.utilization).toBe(71);
    expect(result.data.extra_usage.used_credits).toBe(2003);
  });

  it('does not re-fetch within TTL (cache hit)', async () => {
    const router = usageRouter();
    await callUsageHandler(router);
    await callUsageHandler(router);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns { data: null, error } when credentials file is missing', async () => {
    vi.mocked(readFile).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );
    const result = await callUsageHandler(usageRouter());
    expect(result.data).toBeNull();
    expect(result.error).toBeTypeOf('string');
    expect(result.fetchedAt).toBeTypeOf('number');
  });

  it('returns { data: null, error } when API returns non-ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue('permission_error'),
    }) as any;
    const result = await callUsageHandler(usageRouter());
    expect(result.data).toBeNull();
    expect(result.error).toContain('403');
  });

  it('passes correct Authorization header to API', async () => {
    await callUsageHandler(usageRouter());
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/api/oauth/usage');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-token-123',
    );
  });
});
