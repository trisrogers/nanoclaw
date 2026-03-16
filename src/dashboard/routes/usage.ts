import { readFile } from 'fs/promises';
import { homedir } from 'os';
import path from 'path';

import { Router } from 'express';

const CACHE_TTL_MS = 60_000;
const CREDENTIALS_PATH = path.join(homedir(), '.claude', '.credentials.json');
const USAGE_API = 'https://api.anthropic.com/api/oauth/usage';

interface FiveHour {
  utilization: number;
  resets_at: string;
}

interface SevenDay {
  utilization: number;
  resets_at: string;
}

interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number;
  used_credits: number;
  utilization: number;
}

export interface UsageData {
  five_hour: FiveHour | null;
  seven_day: SevenDay | null;
  extra_usage: ExtraUsage | null;
}

async function getAccessToken(): Promise<string> {
  const raw = await readFile(CREDENTIALS_PATH, 'utf8');
  const creds = JSON.parse(raw);
  const token = creds?.claudeAiOauth?.accessToken ?? creds?.accessToken ?? null;
  if (!token) throw new Error('No access token found in credentials');
  return token;
}

async function fetchUsage(): Promise<UsageData> {
  const token = await getAccessToken();
  const res = await fetch(USAGE_API, {
    headers: {
      Authorization: `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    five_hour: (data.five_hour as FiveHour) ?? null,
    seven_day: (data.seven_day as SevenDay) ?? null,
    extra_usage: (data.extra_usage as ExtraUsage) ?? null,
  };
}

export function usageRouter(): Router {
  let cache: {
    data: UsageData | null;
    error: string | null;
    fetchedAt: number;
  } | null = null;

  const router = Router();
  router.get('/usage', async (_req, res) => {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      res.json(cache);
      return;
    }
    try {
      const data = await fetchUsage();
      cache = { data, error: null, fetchedAt: now };
    } catch (err) {
      cache = {
        data: null,
        error: String(err instanceof Error ? err.message : err),
        fetchedAt: now,
      };
    }
    res.json(cache);
  });
  return router;
}
