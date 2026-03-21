/**
 * One-time backfill: scan session JSONL files from the last N days and
 * insert token usage rows into the token_usage table.
 *
 * Usage:  npx tsx scripts/backfill-token-usage.ts [days=2]
 */
import fs from 'fs';
import path from 'path';
function findJsonl(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findJsonl(full));
    else if (entry.name.endsWith('.jsonl')) results.push(full);
  }
  return results;
}

// Bootstrap the DB (same path as production)
process.chdir(path.resolve(import.meta.dirname, '..'));
const { initDatabase, getDb } = await import('../src/db.js');
initDatabase();
const db = getDb();

const DAYS = parseInt(process.argv[2] ?? '2', 10);
const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

const sessionsRoot = path.resolve('data/sessions');
const files = findJsonl(sessionsRoot);

let inserted = 0;
let skipped = 0;

// Deduplicate by (message_id) — store message IDs we've seen
const seen = new Set<string>();

// Check existing backfilled rows (by source_id if we add one — we don't, so
// just avoid double-running by checking the DB row count before and after)
const before = (
  db.prepare('SELECT COUNT(*) as n FROM token_usage').get() as { n: number }
).n;

const insert = db.prepare(
  `INSERT INTO token_usage (recorded_at, group_folder, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

for (const file of files) {
  // Derive group_folder from path: data/sessions/<group_folder>/.claude/...
  const rel = path.relative(sessionsRoot, file);
  const group_folder = rel.split(path.sep)[0] ?? null;

  let lines: string[];
  try {
    lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  } catch {
    continue;
  }

  for (const line of lines) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const ts: string = (obj.timestamp as string) ?? '';
    if (ts < cutoff) continue; // outside window

    const msg = obj.message as Record<string, unknown> | undefined;
    if (!msg) continue;

    const usage = msg.usage as Record<string, number> | undefined;
    if (!usage?.output_tokens && !usage?.input_tokens) continue;

    // Use message id for dedup
    const msgId = (msg.id as string) ?? '';
    if (msgId && seen.has(msgId)) {
      skipped++;
      continue;
    }
    if (msgId) seen.add(msgId);

    const recorded_at = ts || new Date().toISOString();
    const model = (msg.model as string) ?? null;
    const input_tokens = usage.input_tokens ?? 0;
    const output_tokens = usage.output_tokens ?? 0;
    const cache_read = usage.cache_read_input_tokens ?? 0;
    const cache_write = usage.cache_creation_input_tokens ?? 0;

    try {
      insert.run(
        recorded_at,
        group_folder,
        model,
        input_tokens,
        output_tokens,
        cache_read,
        cache_write,
      );
      inserted++;
    } catch {
      skipped++;
    }
  }
}

const after = (
  db.prepare('SELECT COUNT(*) as n FROM token_usage').get() as { n: number }
).n;
console.log(
  `Backfill complete: inserted ${inserted} rows (${skipped} skipped/deduped)`,
);
console.log(`token_usage table: ${before} → ${after} rows`);
