# Phase 3: Data Panels - Research

**Researched:** 2026-03-16
**Domain:** Express REST routes + React panel components (read-heavy data display, one write endpoint)
**Confidence:** HIGH

## Summary

Phase 3 adds five read-heavy panels to the NanoClaw dashboard: message history browser, CLAUDE.md editor, scheduled tasks viewer, todos board, and Claude usage panel. All five follow patterns already established in Phase 2. The backend uses the route-factory pattern (`function xRouter(): Router`) writing against `getDb()` directly. The frontend adds five new `*Panel.tsx` components to `dashboard/src/components/` and replaces the "coming soon" placeholders in `App.tsx`.

Most of the data is already in the DB (messages, tasks, todos) or filesystem (CLAUDE.md files). The only novel problem is the usage panel: `claude /usage` spawns a subprocess whose output format is undocumented and must be parsed defensively with a 60-second in-process cache.

Two new DB query functions are needed (`getMessagesByGroup` and `getTaskRunLogs`) alongside the five route files. No new npm dependencies are required.

**Primary recommendation:** Follow the logsRouter/statsRouter factory pattern exactly. Call `getDb()` at request time (not at module load). Add LIMIT clauses to every DB query. Build the usage panel with a defensive fallback so a parse failure renders an informational error state rather than a 500.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Message History Panel**
- Layout: Chat bubble style — user messages right-aligned, Deltron/bot messages left-aligned.
- Group selector: Left sub-nav sidebar within the Messages panel, listing all registered groups. Selected group loads its history on the right.
- Fields per message: timestamp, sender_name, content, is_bot_message visual indicator (badge or bubble color).
- Pagination: 50 messages per page (per MSG-01).
- Search: Server-side LIKE query via `/api/messages?group=...&search=...`. Searches entire history across all pages — not just the current page.

**CLAUDE.md Editor Panel**
- Required behavior: Warn user before navigating away with unsaved changes (MEM-03).
- Path traversal guard required (only allow `groups/*/CLAUDE.md` paths).

**Todos Board Panel**
- Layout: Stacked sections — one collapsible section per project with item count badge. Items listed within each section.
- Subtasks: Show indented beneath their parent item.
- Default filter: Open items only. Toggle to show all (open + done + cancelled).
- Assignee: Badge on each item. Two filter buttons (Tristan / Deltron) as preset filters — clicking again clears filter.

**Scheduled Tasks Panel**
- Layout: Table with expandable rows. Columns: group name, prompt (full text, wrapped), schedule, last run, next run, status.
- Click a row to expand and see the last 20 run logs inline.
- Run log columns: run_at, duration_ms, status, result/error truncated to ~100 chars (full text on hover or expand).

**Claude Usage Panel**
- Required behavior: Cache output for 60 seconds (USAGE-02); display gracefully if CLI output can't be parsed.

### Claude's Discretion
- CLAUDE.md editor file selector UX (dropdown, tab strip, or sidebar).
- Claude usage panel layout and error/fallback display.
- Empty states for all panels.
- Exact spacing, typography, icon choices (lucide-react available).
- Error states within panels.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MSG-01 | Browse message history per group, paginated (50 messages per page) | New `getMessagesByGroup(jid, page, search?)` DB query + GET `/api/messages` route with `page` and `group` params |
| MSG-02 | Search message history by text content within a group | Same endpoint, `search` param triggers SQL `LIKE %term%` on `content` column |
| MEM-01 | View and edit global `groups/global/CLAUDE.md` | GET `/api/memory/global` reads file; PUT saves. Special-cased as "global" — not a registered group folder |
| MEM-02 | View and edit per-group `groups/{name}/CLAUDE.md` | GET/PUT `/api/memory/:group` — same handler, validated against registered group folders via `getAllRegisteredGroups()` |
| MEM-03 | Warn before navigating away with unsaved changes | React `useEffect` listening on `beforeunload` event + `isDirty` state flag, cleared on save |
| TASK-01 | View all scheduled tasks (schedule, last run, next run, status) | `getAllTasks()` already exists — wrap in GET `/api/tasks` route |
| TASK-02 | View task run history (last 20 runs per task) | New `getTaskRunLogs(taskId, limit=20)` DB query + GET `/api/tasks/:id/runs` route |
| TODO-01 | View all todo items grouped by project across all groups | `listTodos()` + `listProjects()` already exist — wrap in GET `/api/todos` route; frontend groups by `project_code` |
| TODO-02 | Todo board shows item status, due dates, and assignee | All fields present in `todo_items` schema: `status`, `due_date`, `assignee` |
| USAGE-01 | View Claude Code Pro plan usage (session usage, weekly limit, reset time) | Spawn `claude /usage` subprocess, parse stdout, return structured JSON |
| USAGE-02 | Usage data cached for 60 seconds | Module-scoped `{ data, fetchedAt }` object in the usage route file; return cached if `Date.now() - fetchedAt < 60_000` |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | existing | Route handlers for all five API endpoints | Already used for all Phase 1/2 routes |
| better-sqlite3 | existing | Synchronous DB reads for messages, tasks, todos | Already used — `getDb()` pattern established |
| lucide-react | 0.577.0 | Icons in React components (ChevronDown, Search, Filter, etc.) | Already available in dashboard |
| React 19 + Tailwind CSS v4 | existing | Frontend panel components | Phase 2 established full component pattern |

### No New Dependencies

All five panels can be built with existing dependencies. The usage panel uses Node's built-in `child_process` module to spawn `claude`.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/dashboard/routes/
├── messages.ts       # GET /api/messages?group=<jid>&page=<n>&search=<q>
├── memory.ts         # GET + PUT /api/memory/:group
├── tasks.ts          # GET /api/tasks, GET /api/tasks/:id/runs
├── todos.ts          # GET /api/todos
└── usage.ts          # GET /api/usage (60s cached)

dashboard/src/components/
├── MessagesPanel.tsx  # Chat bubble history + group sub-nav + pagination
├── MemoryPanel.tsx    # CLAUDE.md viewer/editor + unsaved-changes guard
├── TasksPanel.tsx     # Expandable table of scheduled tasks + run logs
├── TodosPanel.tsx     # Collapsible project sections + assignee filter
└── UsagePanel.tsx     # Claude CLI usage display + fallback state
```

### Pattern 1: Route Factory (no DashboardDeps)

Every Phase 3 route reads the DB directly via `getDb()` or calls existing `src/todo.ts` / `src/db.ts` exports. No `DashboardDeps` injection is needed because these are pure data reads.

```typescript
// Source: matches logsRouter() pattern in src/dashboard/routes/logs.ts
import { Router } from 'express';
import { getDb } from '../../db.js';

export function messagesRouter(): Router {
  const router = Router();
  router.get('/messages', (req, res) => {
    const { group, page = '1', search } = req.query as Record<string, string>;
    if (!group) { res.status(400).json({ error: 'group required' }); return; }
    const db = getDb();
    const offset = (parseInt(page) - 1) * 50;
    // ... query with LIMIT 50 OFFSET offset
    res.json(rows);
  });
  return router;
}
```

**Mount in `server.ts`:** `app.use('/api', messagesRouter());` — same pattern as `logsRouter()`.

### Pattern 2: New DB Query Functions

Add to `src/db.ts` (same module that owns all SQLite ops):

```typescript
// getMessagesByGroup — paginated + optional search
export function getMessagesByGroup(
  chatJid: string,
  page: number,
  search?: string,
  pageSize: number = 50,
): { messages: MessageRow[]; total: number } {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const base = search
    ? `WHERE chat_jid = ? AND content LIKE ?`
    : `WHERE chat_jid = ?`;
  const params = search ? [chatJid, `%${search}%`] : [chatJid];
  const total = (db.prepare(`SELECT COUNT(*) as n FROM messages ${base}`)
    .get(...params) as { n: number }).n;
  const messages = db.prepare(
    `SELECT id, chat_jid, sender_name, content, timestamp, is_bot_message
     FROM messages ${base}
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset) as MessageRow[];
  return { messages, total };
}

// getTaskRunLogs — last N runs for a task
export function getTaskRunLogs(taskId: string, limit: number = 20): TaskRunLog[] {
  return getDb()
    .prepare(
      `SELECT * FROM task_run_logs WHERE task_id = ?
       ORDER BY run_at DESC LIMIT ?`
    )
    .all(taskId, limit) as TaskRunLog[];
}
```

### Pattern 3: Memory Route (filesystem read/write + path guard)

The memory route cannot use `resolveGroupFolderPath()` for the "global" case because `global` is in `RESERVED_FOLDERS`. Handle it as a special case:

```typescript
// ALLOWED paths: groups/global/CLAUDE.md, groups/{validFolder}/CLAUDE.md
// groups/global is NOT a registered group — it is the shared identity file
// registered groups come from getAllRegisteredGroups()

function resolveMemoryPath(group: string): string | null {
  const GROUPS_DIR = path.resolve(process.cwd(), 'groups');
  if (group === 'global') {
    return path.join(GROUPS_DIR, 'global', 'CLAUDE.md');
  }
  // Validate against registered groups only — reject unknown folder names
  const registered = getAllRegisteredGroups();
  const known = Object.values(registered).map(g => g.folder);
  if (!known.includes(group)) return null;
  // Double-check no path traversal
  const resolved = path.resolve(GROUPS_DIR, group, 'CLAUDE.md');
  if (!resolved.startsWith(GROUPS_DIR + path.sep)) return null;
  return resolved;
}
```

Note: `isValidGroupFolder()` rejects `global` (it's in RESERVED_FOLDERS). The memory route needs its own whitelist logic that explicitly permits global while rejecting unknown names.

### Pattern 4: Usage Subprocess + Cache

Spawn the `claude` binary using `spawn` with captured stdout (not `exec`/shell), preventing shell injection. Cache result by timestamp.

```typescript
import { spawn } from 'child_process';

let usageCache: { data: UsageData | null; error: string | null; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

function runClaudeUsage(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn('claude', ['/usage'], { timeout: 10_000 });
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
      else reject(new Error(`claude /usage exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

export function usageRouter(): Router {
  const router = Router();
  router.get('/usage', async (_req, res) => {
    const now = Date.now();
    if (usageCache && now - usageCache.fetchedAt < CACHE_TTL_MS) {
      res.json(usageCache); return;
    }
    try {
      const stdout = await runClaudeUsage();
      const data = parseUsageOutput(stdout);  // best-effort, never throws
      usageCache = { data, error: null, fetchedAt: now };
    } catch (err) {
      usageCache = { data: null, error: String(err), fetchedAt: now };
    }
    res.json(usageCache);
  });
  return router;
}
```

The client displays a fallback message ("Usage data unavailable") when `data` is null.

### Pattern 5: Unsaved Changes Guard (MEM-03)

```typescript
// In MemoryPanel.tsx
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (isDirty) { e.preventDefault(); e.returnValue = ''; }
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [isDirty]);
```

For in-app navigation (clicking a different sidebar item), App.tsx passes a callback or the panel sets a module-level flag. Simplest approach: keep an `isDirty` ref in MemoryPanel, and when the nav item changes, check via a passed `onNavigate` prop that returns `window.confirm('Unsaved changes...')` when dirty.

### Anti-Patterns to Avoid

- **Calling `getDb()` at module load time:** DB initialises after module import; always call `getDb()` inside the request handler.
- **Unbounded queries:** Every DB query needs a LIMIT. better-sqlite3 is synchronous and blocks Telegram message delivery.
- **Trusting `:group` param without whitelist:** The memory PUT endpoint must validate the group name against known folders before writing to disk.
- **Using `isValidGroupFolder` to gate the global file:** `global` is in RESERVED_FOLDERS and will return false — use explicit allow-list instead.
- **Swallowing subprocess errors silently in usage panel:** Cache the error and surface it to the client; never return a 500 from the usage endpoint.
- **Using `exec()` or shell spawning for the usage subprocess:** Use `spawn('claude', ['/usage'])` with an explicit args array to avoid shell injection risk, even though the args are static.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination offset math | Custom offset/limit logic | SQL `LIMIT ? OFFSET ?` | Single DB round trip, all correctness at DB layer |
| Path traversal prevention | Custom string manipulation | `path.resolve` + `startsWith(base + sep)` check | Covers all edge cases including symlinks and platform separators |
| Text search | Client-side JS filter | SQL `content LIKE '%term%'` | Searches full history across all pages, not just current page |
| Collapsible sections | Custom accordion | Simple React `useState` open/closed per project code | No library needed; 10 lines of JSX |
| Usage data freshness | setInterval refresh | Request-time TTL cache (`Date.now() - fetchedAt < 60_000`) | Avoids background timer; data is fetched on demand |

---

## Common Pitfalls

### Pitfall 1: LIKE Search Index Miss

**What goes wrong:** `content LIKE '%term%'` with a leading wildcard cannot use the existing `idx_timestamp` index. On large message tables this causes a full table scan.

**Why it happens:** SQLite cannot use a B-tree index when the LIKE pattern starts with `%`.

**How to avoid:** Add a composite index `CREATE INDEX IF NOT EXISTS idx_messages_jid_ts ON messages(chat_jid, timestamp DESC)` in the DB migration. The leading `chat_jid =` equality predicate will use it; the LIKE is a post-filter. For this personal-scale deployment the full-scan risk is low, but the composite index also speeds up all paginated queries.

**Warning signs:** Slow response when `search` is provided; check with `EXPLAIN QUERY PLAN`.

### Pitfall 2: Memory Route Writing to Wrong Path

**What goes wrong:** A crafted `group` parameter like `../../../etc/passwd` or `global/../telegram_main` causes the route to write outside `groups/`.

**Why it happens:** Naive `path.join(GROUPS_DIR, group, 'CLAUDE.md')` with unsanitized input.

**How to avoid:** Always resolve to an absolute path and assert it starts with `GROUPS_DIR + path.sep` before reading or writing. Additionally, validate against the registered-group whitelist (or the explicit `global` allowance) before touching the filesystem.

### Pitfall 3: Usage CLI Not Found

**What goes wrong:** `spawn('claude', ...)` throws `ENOENT` because `claude` is not in PATH when the process is started by systemd.

**Why it happens:** systemd units inherit a minimal PATH that may not include `~/.local/bin` or wherever `claude` is installed.

**How to avoid:** Catch the error and return `{ data: null, error: 'claude CLI not found in PATH' }`. The client renders the fallback gracefully. Document this known failure mode in the route file comment. Optionally accept a `CLAUDE_BIN` env var override for custom install paths.

### Pitfall 4: MEM-03 In-App Navigation Not Covered by `beforeunload`

**What goes wrong:** `beforeunload` only fires on full page navigate or close, not when the user clicks a sidebar nav item (which is a React state change).

**Why it happens:** React SPA navigation doesn't trigger `beforeunload`.

**How to avoid:** In `App.tsx`, wrap the `setActive(item)` call so it first checks an exported `isDirtyRef` from MemoryPanel (or passes a guard callback). If dirty, show a `window.confirm()` dialog before switching panels. Alternatively, render a warning banner within the MemoryPanel itself that's visible when dirty.

### Pitfall 5: Task Run Log Volume

**What goes wrong:** `getTaskRunLogs` returns all rows if LIMIT is omitted, potentially thousands of entries.

**Why it happens:** Scheduled tasks run every N minutes indefinitely — run logs accumulate.

**How to avoid:** Always pass `LIMIT 20` in `getTaskRunLogs`. The route should also cap at 20 regardless of any query param.

---

## Code Examples

Verified patterns from existing codebase:

### DB query at request time (not module load)
```typescript
// Source: src/dashboard/routes/stats.ts
router.get('/stats', (_req, res) => {
  res.json({ channelsConnected: deps.getChannels().filter((ch) => ch.isConnected()).length });
});
// Note: deps resolved at request time, not stored at module load
```

### Router factory pattern (no deps)
```typescript
// Source: src/dashboard/routes/logs.ts
export function logsRouter(): Router {
  const router = Router();
  router.get('/logs', (_req, res) => { /* ... */ });
  return router;
}
// Mounted in server.ts: app.use('/api', logsRouter());
```

### Mounting in server.ts
```typescript
// Source: src/dashboard/server.ts — pattern to replicate for Phase 3
app.use('/api', statsRouter(deps));   // with deps
app.use('/api', logsRouter());        // without deps
// Phase 3 routes all follow logsRouter() pattern (no deps)
```

### SQLite synchronous query with LIMIT (established constraint)
```typescript
// Source: STATE.md decision [01-02] and src/db.ts
// LIMIT is REQUIRED on all dashboard DB queries —
// better-sqlite3 is synchronous and blocks the event loop
```

### Chat bubble classes (reuse from ChatPanel)
```typescript
// Source: dashboard/src/components/ChatPanel.tsx
// Bot messages (left):  'bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 text-sm whitespace-pre-wrap'
// User messages (right): 'bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm whitespace-pre-wrap'
```

### usePoll hook (reuse from ContainersPanel)
```typescript
// Source: dashboard/src/components/ContainersPanel.tsx
// Generic polling hook: usePoll<T>(url, intervalMs, refresh)
// Phase 3 panels can define their own simpler useEffect fetch since they
// don't need refresh triggers — but the pattern is established.
```

### Dark theme palette (all panels must match)
```
bg-gray-950  — page background
bg-gray-900  — sidebar, card headers
bg-gray-800  — inputs, table rows, bubble backgrounds
text-gray-100 — primary text
text-gray-400 — secondary/muted text
border-gray-800 — all dividers
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Separate global/per-group memory routes | Single `memory.ts` with special-cased global | Simpler server.ts mount |
| Modal confirm dialogs | Inline `window.confirm()` for unsaved-changes guard | Matches existing ContainersPanel confirm pattern |

---

## Open Questions

1. **`claude /usage` exact output format**
   - What we know: STATE.md flags this as undocumented. The command exists and produces some output.
   - What's unclear: Whether output is JSON, plain text, or structured differently across versions.
   - Recommendation: In 03-05, run `claude /usage` empirically before building the parser. Build `parseUsageOutput` to be defensive — return partial data rather than throw. If no data can be parsed, `data` is null and the client shows the fallback state.

2. **`global` CLAUDE.md content size**
   - What we know: `groups/global/CLAUDE.md` is the agent identity file — likely a few KB.
   - What's unclear: Whether very large files would cause any issue with `express.json()` body parser limits.
   - Recommendation: Set `express.json({ limit: '1mb' })` on the memory PUT handler as a guard. Current default is 100kb which should be fine for CLAUDE.md files.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (configured in `vitest.config.ts`) |
| Config file | `vitest.config.ts` — `include: ['src/**/*.test.ts', 'setup/**/*.test.ts']` |
| Quick run command | `npx vitest run src/dashboard/routes/messages.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MSG-01 | `getMessagesByGroup` returns 50 results with correct offset | unit | `npx vitest run src/db.test.ts` | ❌ Wave 0 — new DB function |
| MSG-01 | GET `/api/messages` returns paginated data | unit | `npx vitest run src/dashboard/routes/messages.test.ts` | ❌ Wave 0 |
| MSG-02 | GET `/api/messages?search=foo` filters by LIKE | unit | `npx vitest run src/dashboard/routes/messages.test.ts` | ❌ Wave 0 |
| MEM-01 | GET `/api/memory/global` returns CLAUDE.md content | unit | `npx vitest run src/dashboard/routes/memory.test.ts` | ❌ Wave 0 |
| MEM-02 | GET `/api/memory/:group` validates against registered groups | unit | `npx vitest run src/dashboard/routes/memory.test.ts` | ❌ Wave 0 |
| MEM-02 | PUT `/api/memory/:group` with traversal attempt returns 400 | unit | `npx vitest run src/dashboard/routes/memory.test.ts` | ❌ Wave 0 |
| MEM-03 | `isDirty` flag prevents in-app navigation without confirm | manual-only | N/A — browser UI behaviour | N/A |
| TASK-01 | GET `/api/tasks` returns all tasks from DB | unit | `npx vitest run src/dashboard/routes/tasks.test.ts` | ❌ Wave 0 |
| TASK-02 | `getTaskRunLogs` returns max 20 rows | unit | `npx vitest run src/db.test.ts` | ❌ Wave 0 — new DB function |
| TASK-02 | GET `/api/tasks/:id/runs` returns run logs | unit | `npx vitest run src/dashboard/routes/tasks.test.ts` | ❌ Wave 0 |
| TODO-01 | GET `/api/todos` returns items + projects | unit | `npx vitest run src/dashboard/routes/todos.test.ts` | ❌ Wave 0 |
| TODO-02 | Response includes status, due_date, assignee | unit | `npx vitest run src/dashboard/routes/todos.test.ts` | ❌ Wave 0 |
| USAGE-01 | GET `/api/usage` returns parsed usage when CLI succeeds | unit | `npx vitest run src/dashboard/routes/usage.test.ts` | ❌ Wave 0 |
| USAGE-02 | Second request within 60s returns cached data without re-spawning | unit | `npx vitest run src/dashboard/routes/usage.test.ts` | ❌ Wave 0 |
| USAGE-01 | GET `/api/usage` returns `{ data: null, error: ... }` when CLI fails | unit | `npx vitest run src/dashboard/routes/usage.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Run the specific route test file (`npx vitest run src/dashboard/routes/<route>.test.ts`)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/dashboard/routes/messages.test.ts` — covers MSG-01, MSG-02
- [ ] `src/dashboard/routes/memory.test.ts` — covers MEM-01, MEM-02 (path traversal guard)
- [ ] `src/dashboard/routes/tasks.test.ts` — covers TASK-01, TASK-02
- [ ] `src/dashboard/routes/todos.test.ts` — covers TODO-01, TODO-02
- [ ] `src/dashboard/routes/usage.test.ts` — covers USAGE-01, USAGE-02 (cache TTL)
- [ ] New DB function tests in `src/db.test.ts` — `getMessagesByGroup` (pagination + search), `getTaskRunLogs` (LIMIT=20)
- [ ] `src/db.ts` migration: composite index `idx_messages_jid_ts ON messages(chat_jid, timestamp DESC)` for paginated and search queries

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `src/db.ts`, `src/todo.ts`, `src/group-folder.ts`, `src/dashboard/server.ts`, `src/dashboard/routes/*.ts`, `dashboard/src/components/*.tsx`, `dashboard/src/App.tsx`
- Schema verified from `createSchema()` in `src/db.ts` — all table/column names confirmed
- Pattern confirmed from `vitest.config.ts` and existing `*.test.ts` files — test framework and conventions verified

### Secondary (MEDIUM confidence)

- Node.js `child_process.spawn` API — standard library, stable
- SQLite LIKE index behaviour — well-documented limitation (leading wildcard prevents index use)

### Tertiary (LOW confidence — validate empirically)

- `claude /usage` output format — flagged as undocumented in STATE.md; must be verified by running the command before building the parser in 03-05

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in active use
- Architecture: HIGH — all patterns directly derived from Phase 2 code that exists and runs
- DB queries: HIGH — schema confirmed from live `src/db.ts`; `getMessagesByGroup` and `getTaskRunLogs` are straightforward extensions of existing patterns
- Path traversal guard: HIGH — `group-folder.ts` logic understood; global special-case documented
- Usage panel: MEDIUM — subprocess approach is standard; parse logic is LOW until `claude /usage` output is verified empirically
- Pitfalls: HIGH — derived from architectural constraints already documented in STATE.md and CODEBASE.md

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable codebase; only risk is `claude` CLI output format changing)
