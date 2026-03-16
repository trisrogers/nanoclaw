import { readFile } from 'fs/promises';
import { homedir } from 'os';
import path from 'path';

import { Router } from 'express';

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
}

interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

interface StatsCache {
  lastComputedDate?: string;
  modelUsage?: Record<string, ModelUsage>;
  dailyActivity?: DailyActivity[];
  totalSessions?: number;
  totalMessages?: number;
  firstSessionDate?: string;
}

export interface UsageData {
  lastComputedDate: string | null;
  modelUsage: Record<string, ModelUsage>;
  recentActivity: DailyActivity[];
  totalSessions: number;
  totalMessages: number;
  firstSessionDate: string | null;
}

const CACHE_TTL_MS = 60_000;
const STATS_PATH = path.join(homedir(), '.claude', 'stats-cache.json');

async function readStatsCache(): Promise<UsageData> {
  const raw = await readFile(STATS_PATH, 'utf8');
  const stats: StatsCache = JSON.parse(raw);

  const activity = stats.dailyActivity ?? [];
  // Return last 14 days of activity, most recent first
  const recentActivity = [...activity].reverse().slice(0, 14);

  return {
    lastComputedDate: stats.lastComputedDate ?? null,
    modelUsage: stats.modelUsage ?? {},
    recentActivity,
    totalSessions: stats.totalSessions ?? 0,
    totalMessages: stats.totalMessages ?? 0,
    firstSessionDate: stats.firstSessionDate ?? null,
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
      const data = await readStatsCache();
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
