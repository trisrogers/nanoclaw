# Pitfalls Research

**Domain:** Adding a React SPA dashboard to an existing Node.js/TypeScript AI assistant process
**Researched:** 2026-03-15
**Confidence:** HIGH (grounded in actual NanoClaw source + verified community patterns)

---

## Critical Pitfalls

### Pitfall 1: Dashboard HTTP Server Not Included in Shutdown Handler

**What goes wrong:**
The existing `shutdown()` function in `src/index.ts` (lines 507-513) closes `proxyServer` and drains `queue`, then calls `process.exit(0)`. If the new Express/HTTP server is not registered in that same shutdown handler, systemd's `systemctl stop nanoclaw` will SIGTERM the process, the handler will run, but open keep-alive HTTP connections to the dashboard will hold the event loop open past `process.exit(0)` — or worse, `process.exit(0)` will tear down mid-request, returning a TCP RST to the browser.

**Why it happens:**
The server is added in a new code block and the developer forgets to thread its `close()` call into the existing `shutdown()` function. The existing handler calls `process.exit(0)` unconditionally, so there is no second chance.

**How to avoid:**
Store the Express `http.Server` instance at module scope immediately at creation. Add `dashboardServer.close()` as the first line of the existing `shutdown()` handler before `proxyServer.close()`. Do not create a second SIGTERM/SIGINT handler — the existing one must be extended, not duplicated.

**Warning signs:**
- `systemctl restart nanoclaw` hangs for 90 seconds before the service finally dies (systemd kill timeout).
- Browser requests to the dashboard return connection reset errors after `stop` is issued.
- Logs show "Shutdown signal received" but process does not exit promptly.

**Phase to address:** Phase 1 — HTTP server bootstrapping. The shutdown extension must be the very first thing wired up when the server is created.

---

### Pitfall 2: Dashboard Chat Session Collides With Existing Telegram Session

**What goes wrong:**
The orchestrator in `src/index.ts` uses `sessions[group.folder]` keyed by folder name. If the dashboard group is registered with `folder: "dashboard"` and then a Telegram group is also named `dashboard` (even by coincidence), they share a Claude session ID. More concretely: the `sessions` dict and `registeredGroups` dict are both in-memory. If a message arrives for `jid: dashboard` from both the dashboard WebSocket and a hypothetical Telegram group simultaneously, two `processGroupMessages` calls can interleave, each reading and writing `sessions["dashboard"]` and advancing `lastAgentTimestamp["dashboard"]` independently. This causes cursor corruption and duplicate or dropped messages — exactly the bug described in `CONCERNS.md` ("Message Cursor Rollback Logic").

**Why it happens:**
The dashboard injects messages into the same orchestrator flow that all other channels use. The folder-scoped in-memory state is a single dict with no locking. The message loop polls `getNewMessages(jids, lastTimestamp, ...)` and a WebSocket inject path both advance state for the same JID.

**How to avoid:**
Give the dashboard group a JID prefix that can never collide with real Telegram JIDs. Telegram JIDs are `tg:<user_id>` or `tg:<chat_id>`. Use `jid: "web:dashboard"`. Validate at startup that no registered group has a folder name of `dashboard` before creating the dashboard group. Do not route dashboard messages through `getNewMessages` polling — inject them directly into the `queue` to guarantee serialization.

**Warning signs:**
- Dashboard chat replies arrive in Telegram (messages routed to wrong channel).
- `lastTimestamp` or `lastAgentTimestamp` advances for `dashboard` while Telegram is also processing.
- Session IDs in the DB flicker between two values.

**Phase to address:** Phase 2 — Dashboard chat channel registration and WebSocket message injection.

---

### Pitfall 3: better-sqlite3 Synchronous Reads Block the Message Loop During Dashboard Polls

**What goes wrong:**
`better-sqlite3` is synchronous. Every `db.prepare(...).all()` call blocks the Node.js event loop until the query returns. The NanoClaw message loop runs in the same process thread. If the dashboard API serves a request that triggers a slow query — e.g., `getMessagesSince()` over a large messages table, or a full log-file scan — the event loop freezes for that duration. During the freeze, no Telegram messages are polled, no IPC files are processed, and no container output is forwarded to users.

**Why it happens:**
Dashboard API endpoints are added alongside message loop code. In development the DB is small so queries are fast. In production, after months of use, `messages` grows into tens of thousands of rows and a naive `SELECT * FROM messages WHERE chat_jid = ?` without tight LIMIT/INDEX usage runs in hundreds of milliseconds.

**How to avoid:**
Enforce a hard `LIMIT` (50–100 rows) on every dashboard-facing DB query. Always filter by `chat_jid` first (indexed). Never do a full-table scan from an HTTP handler. Prefer `ORDER BY timestamp DESC LIMIT N` patterns (see the existing `getMessagesSince` performance concern in `CONCERNS.md` — address it before the dashboard queries it heavily). The existing `idx_timestamp` index on `messages(timestamp)` helps only when filtering by timestamp, not by `chat_jid` alone.

**Warning signs:**
- Telegram message response latency increases when the dashboard browser tab is open and auto-refreshing.
- Pino logs show gaps in IPC poll cycles during dashboard activity.
- `better-sqlite3` query time visible in Node.js `--prof` output exceeding 10ms.

**Phase to address:** Phase 3 — Dashboard data panels (message history, log viewer). Add explicit LIMIT constraints to all new DB-reading API endpoints before they are wired up.

---

### Pitfall 4: Vite Dev Proxy Works But Production Static Serving Is Broken

**What goes wrong:**
During development, Vite's `server.proxy` setting forwards `/api` and `/ws` to the NanoClaw backend. This hides a misconfiguration: in production, Express serves `dist/` as static files and all non-file requests must fall through to `index.html` for client-side routing. If the catch-all `app.get('*', sendFile('index.html'))` is placed before the `/api` routes, every API call returns HTML. If it is placed incorrectly after a 404 handler, SPA deep links 404 in production. The dev proxy never reveals this because it is bypassed in production.

**Why it happens:**
Developers test only in `npm run dev` mode and never build + serve the production bundle locally. The two serving strategies are different enough that one can work while the other is broken.

**How to avoid:**
Before shipping Phase 1, run a production build locally: `npm run build` in `dashboard/`, then restart NanoClaw and verify that (a) `/api/health` returns JSON, (b) `/` serves `index.html`, and (c) `/some/deep/route` also serves `index.html` and the SPA router handles it. The Express route order must be: API routes first, then `express.static(distDir)`, then `app.get('*', ...)` catch-all last.

**Warning signs:**
- API calls from the browser return `<!DOCTYPE html>` instead of JSON.
- Browser Network tab shows 200 status on API calls but response content-type is `text/html`.
- SPA works on `/` but hard-refreshing `/logs` or `/tasks` returns a 404 or blank page.

**Phase to address:** Phase 1 — Static file serving setup. Verify production build path as part of Phase 1 acceptance criteria.

---

### Pitfall 5: React StrictMode Creates Duplicate WebSocket Connections in Development

**What goes wrong:**
React 18 StrictMode intentionally double-invokes `useEffect` in development to catch side effects. A WebSocket opened in `useEffect` with no proper cleanup will fire twice: connect, close, connect. The server sees two simultaneous connections for the same "dashboard" session. Worse, the first connection may receive the initial message queue before the second stabilizes, causing missed messages or duplicate event handlers on the client.

**Why it happens:**
The `ws` package on the server has no concept of logical session deduplication by default. Each HTTP upgrade becomes a separate WebSocket connection. Two connections from the same browser tab are indistinguishable server-side.

**How to avoid:**
Assign a `connectionId` (random UUID) to each WebSocket connection server-side. Do not attempt to deduplicate on the server. On the client, manage the WebSocket lifecycle in a `useRef` (not `useState`) and return a cleanup function from `useEffect` that calls `ws.close()`. Accept that in development you will see a connect+close+connect sequence and log it clearly — do not treat it as an error. Verify stable behavior in production build where StrictMode double-invocation does not occur.

**Warning signs:**
- Server logs show two WS `open` events followed immediately by one `close` event per page load in dev mode.
- Chat messages delivered twice in development.
- Disappears entirely in production build.

**Phase to address:** Phase 2 — WebSocket implementation and React chat component.

---

### Pitfall 6: In-Memory State Exposed Over HTTP Without Serialization Guard

**What goes wrong:**
The dashboard's `/api/status` or `/api/groups` endpoint reads `registeredGroups` (a live `Record<string, RegisteredGroup>` in `src/index.ts`). If the HTTP handler serializes this via `JSON.stringify` while the message loop is simultaneously mutating it (e.g., `registerGroup()` inserting a new key), the serialization reads a partially-updated object. JavaScript objects are not thread-safe but since Node.js is single-threaded this is not a data race — however, an async gap mid-handler (e.g., `await someAsyncThing(); res.json(registeredGroups)`) can yield execution back to the message loop, which then mutates the object before the response is sent.

**Why it happens:**
Developers assume "it's single-threaded so it's safe." Single-threaded does not mean atomic across async awaits.

**How to avoid:**
Snapshot the state synchronously before any await: `const snapshot = { ...registeredGroups }` at the top of the handler. Never hold a reference to the live `registeredGroups` object across an await boundary in an HTTP handler. For read-only panels, prefer reading from SQLite (which is always consistent) over the in-memory dict.

**Warning signs:**
- Dashboard shows a group that was just deleted (stale snapshot served after mutation).
- JSON serialization error in logs (`TypeError: Converting circular structure to JSON`) if any live object has circular refs added later.

**Phase to address:** Phase 2 — API endpoint implementation.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Poll all endpoints on a fixed 5s interval from React | Simple, no WebSocket complexity | Hammers SQLite when browser tab is left open; compounds with existing IPC poll load | Only if total dashboard query time per cycle stays under 5ms |
| Single `/api/state` mega-endpoint returning all data | One fetch per render cycle | Fetches data for panels not currently visible; response grows as DB grows | Never — split by panel/resource |
| Serve `dashboard/dist` with a relative path `./dashboard/dist` | Works locally | Breaks when process cwd changes (systemd may set cwd to `/`) | Never — always use `path.resolve(__dirname, ...)` or equivalent |
| Skip WAL mode on SQLite | No config change needed | Concurrent read+write from HTTP handlers and message loop can serialize unnecessarily | Never for a dashboard scenario — enable WAL mode in `initDatabase()` |
| Hardcode dashboard port 3000 | Simple | Conflicts with other local services; no way to override without code change | Only as a default — always read from env `DASHBOARD_PORT` |

---

## Integration Gotchas

Common mistakes when connecting components of this specific system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vite dev proxy + WebSocket | Proxying `/api` but forgetting to proxy WebSocket upgrades separately | In `vite.config.ts`, set `proxy['/ws'] = { target, ws: true }` — HTTP and WS proxies are configured independently |
| IPC watcher + dashboard chat inject | Injecting a dashboard message by writing an IPC file while IPC watcher is already processing another file for the same group | Use the existing `queue.enqueue()` path directly, not the IPC file mechanism, to guarantee serial processing per group |
| `better-sqlite3` + `express.json()` | Forgetting that `better-sqlite3` is synchronous and Express middleware chain is async — mixing async middleware with sync DB calls | Keep all DB calls synchronous inside the handler; do not wrap them in `Promise.resolve()` or `util.promisify()` which adds a microtask tick without gaining actual async |
| Log file reading for activity feed | Opening log file with `fs.readFileSync` on every poll request | Use a tail-style read (track byte offset) or use `fs.createReadStream` with a start offset; never stat+read the entire log on each HTTP request |
| CLAUDE.md editor endpoint | Reading and writing `groups/*/CLAUDE.md` directly from HTTP handler | Validate the path against `resolveGroupFolderPath()` and the registered groups list before any file I/O; otherwise a crafted group name like `../../etc/passwd` traverses the filesystem |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling message history for all groups at once | Dashboard load spikes SQLite; Telegram response lag | Paginate per group; load only the currently viewed group | With 5+ groups each having 1000+ messages |
| `setInterval` polls that never self-terminate | Memory growth over days; increasing GC pause | Always clear intervals in React `useEffect` cleanup; never attach intervals to module scope that aren't clearable | Visible in `process.memoryUsage()` after 24h uptime |
| Large log file tail via HTTP | Response time grows linearly with log size | Read from a fixed byte offset; impose a max line count (e.g. last 500 lines only) | Log files exceed 10MB after a few weeks |
| Streaming `claude /usage` output per request | Multiple concurrent dashboard tabs each spawn a subprocess | Cache the usage output for 60 seconds; run the subprocess once, return cached result to all callers | 2+ browser tabs open simultaneously |
| Full `JSON.stringify(registeredGroups)` on every poll | Works fine with 3 groups; slower with 20+ | Serve a minimal projection (jid, name, status) not the full object | 20+ registered groups |

---

## Security Mistakes

Domain-specific issues for a no-auth LAN dashboard.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Binding dashboard server to `0.0.0.0` without documentation | Exposed on all interfaces including the WAN interface if the machine is dual-homed or port-forwarded | Default to `127.0.0.1`; require `DASHBOARD_BIND=0.0.0.0` to be explicitly set; log a warning when binding to all interfaces at startup |
| CLAUDE.md editor writes arbitrary paths | A crafted HTTP request with `folder=../../.env` reads or overwrites credentials | Resolve the path, check it is under the `groups/` directory, and verify the folder name exists in `registeredGroups` before any file operation |
| Dashboard API exposes full `registeredGroups` including internal fields | `isMain`, channel routing, folder paths visible to anyone on LAN | Not a high risk on a home LAN, but filter the response to fields the UI actually needs |
| No rate limiting on `claude /usage` endpoint | Repeated polling spawns unbounded child processes | Cache with a 60-second TTL; reject requests while a subprocess is in flight |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Chat panel resets scroll position on every poll | Jarring jump to bottom mid-conversation | Only auto-scroll when user is already at bottom; preserve scroll position on new data arriving above |
| Container status shows "running" but container has exited | Stale status misleads user | Poll status from the running container list in the queue, not just from SQLite; the queue has live truth |
| Action buttons (clear session, restart container) show no feedback | User clicks twice; action fires twice | Disable button immediately on click; re-enable only after API response; show spinner |
| Full message history loads on group select | Long pause when switching groups with thousands of messages | Load last 50 messages on select; paginate backward on demand |
| Log viewer shows raw Pino JSON | Unreadable for non-developers | Parse `msg`, `level`, `time` fields; render as human-readable log lines with level color coding |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **HTTP server shutdown:** Dashboard server appears to start correctly — verify it is registered in the `shutdown()` handler in `src/index.ts` and that `systemctl restart nanoclaw` completes cleanly (no 90s hang).
- [ ] **Dashboard chat session isolation:** Chat appears to work in dev — verify the `dashboard` group JID cannot collide with a real Telegram JID and that session state is not shared with Telegram groups.
- [ ] **Production static serving:** SPA loads on `/` in dev — build `dashboard/dist` and verify deep links (e.g. `/tasks`, `/logs`) return `index.html` and not 404 when accessed directly.
- [ ] **SQLite WAL mode:** Dashboard reads appear fast in dev — verify WAL mode is enabled in `initDatabase()` so concurrent HTTP reads and message-loop writes do not serialize.
- [ ] **Vite WebSocket proxy:** API proxy works in dev — verify `/ws` upgrade is also proxied (requires `ws: true` in Vite proxy config, separate from the HTTP proxy entry).
- [ ] **CLAUDE.md path traversal guard:** Editor saves correctly for valid groups — verify a request with `folder=../../.env` is rejected before any file read/write.
- [ ] **Log viewer byte offset:** Log tail returns recent lines — verify it does not re-read the entire log file on each request after the log grows beyond 1MB.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dashboard server not in shutdown handler (service hangs on restart) | LOW | Add `dashboardServer.close()` to `shutdown()`, rebuild, restart service |
| Dashboard chat session corrupted / colliding with Telegram | MEDIUM | Run `/new` command in Telegram to clear the Telegram session; delete the `dashboard` row from the `sessions` table in SQLite; restart service |
| SQLite slow query blocking message loop | MEDIUM | Add `LIMIT` to the offending API handler; if already deployed, restart service to clear event loop backlog; query runs synchronously so there is no cancel — prevention is the only real fix |
| Vite dev proxy not forwarding WebSocket | LOW | Add `ws: true` to the proxy entry in `vite.config.ts`; dev server restart required |
| Production SPA deep links 404ing | LOW | Reorder Express middleware: API routes first, `express.static` second, `app.get('*')` catch-all last; rebuild and redeploy |
| CLAUDE.md path traversal write executed | HIGH | Restore affected files from git; audit `groups/` directory for unexpected files; add path validation before redeploy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| HTTP server not in shutdown handler | Phase 1 (HTTP server bootstrap) | `systemctl restart nanoclaw` completes in under 5 seconds with no error |
| Dashboard chat session collision | Phase 2 (dashboard chat channel) | Confirm `jid: "web:dashboard"` pattern; send a message from dashboard and verify it does not appear in Telegram |
| SQLite blocking event loop | Phase 3 (data API endpoints) | All dashboard API handlers have explicit LIMIT; measure Telegram response latency with and without dashboard tab open |
| Vite proxy missing WebSocket | Phase 1 (dev setup) | WebSocket connects successfully in `npm run dev` mode without configuring CORS manually |
| Production static serving broken | Phase 1 (HTTP server bootstrap) | Run production build locally and verify all routes before merging |
| In-memory state read across await | Phase 2 (API endpoints) | Snapshot state before any async operation in every HTTP handler |
| React StrictMode duplicate WS | Phase 2 (React chat component) | Review WS connection count in server logs on dev page load; expect 2 then 1, not 2 persistent |
| CLAUDE.md path traversal | Phase 4 (memory editor) | Attempt request with `folder=../../.env` and verify 400/403 response |

---

## Sources

- NanoClaw `src/index.ts` (shutdown handler, `sessions` dict, `registeredGroups` dict) — direct source inspection
- NanoClaw `.planning/codebase/CONCERNS.md` — message cursor rollback, SQLite single-connection model, IPC race condition
- NanoClaw `.planning/PROJECT.md` — dashboard requirements and tech stack decisions
- `better-sqlite3` GitHub issue #32 "Worried about synchronicity" — synchronous event loop blocking confirmed
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) — synchronous API by design
- [Vite backend integration docs](https://vite.dev/guide/backend-integration) — `ws: true` proxy requirement
- [How to Avoid Multiple WebSocket Connections in React](https://getstream.io/blog/websocket-connections-react/) — StrictMode double-mount pattern (MEDIUM confidence — community source)
- [Node.js Graceful Shutdown — Express docs](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html) — `server.close()` and keep-alive connection behavior (HIGH confidence)
- [Avoiding Memory Leaks in Node.js — AppSignal](https://blog.appsignal.com/2020/05/06/avoiding-memory-leaks-in-nodejs-best-practices-for-performance.html) — setInterval cleanup patterns (MEDIUM confidence)

---
*Pitfalls research for: NanoClaw Dashboard (React SPA + Node.js process integration)*
*Researched: 2026-03-15*
