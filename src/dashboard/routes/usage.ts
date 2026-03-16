import { spawn } from 'child_process';
import { Router } from 'express';

interface UsageData {
  sessionUsage?: string;
  weeklyLimit?: string;
  resetTime?: string;
  raw?: string;
}

const CACHE_TTL_MS = 60_000;

/**
 * Defensive parser for `claude /usage` output.
 * Attempts to extract known fields via regex.
 * Falls back to { raw: stdout } when nothing matches.
 * Never throws.
 */
function parseUsageOutput(stdout: string): UsageData {
  const data: UsageData = { raw: stdout };

  // Try to extract session usage (e.g. "Session: 100 tokens" or "Session usage: 100")
  const sessionMatch = stdout.match(/session(?:\s+usage)?[:\s]+([^\n]+)/i);
  if (sessionMatch) {
    data.sessionUsage = sessionMatch[1].trim();
  }

  // Try to extract weekly limit (e.g. "Weekly limit: 500 tokens")
  const weeklyMatch = stdout.match(/weekly\s+limit[:\s]+([^\n]+)/i);
  if (weeklyMatch) {
    data.weeklyLimit = weeklyMatch[1].trim();
  }

  // Try to extract reset time (e.g. "Resets: Monday" or "Reset time: ...")
  const resetMatch = stdout.match(
    /reset(?:s)?(?:\s+(?:time|at|on))?[:\s]+([^\n]+)/i,
  );
  if (resetMatch) {
    data.resetTime = resetMatch[1].trim();
  }

  return data;
}

function runClaudeUsage(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn('claude', ['/usage'], { timeout: 10_000 });
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
      else reject(new Error(`claude /usage exited with code ${code}`));
    });
    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT')
        reject(new Error('claude CLI not found in PATH'));
      else reject(err);
    });
  });
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
      const stdout = await runClaudeUsage();
      const data = parseUsageOutput(stdout);
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
