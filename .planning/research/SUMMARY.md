# Project Research Summary

**Project:** NanoClaw Dashboard
**Domain:** React SPA operator dashboard integrated into existing Node.js/TypeScript AI assistant process
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

The NanoClaw dashboard is a single-user, LAN-only operator control panel that plugs into the existing NanoClaw Node.js process. Experts build this class of tool by adding a minimal HTTP server (Express + ws) to the existing process — not by spinning up a separate service — and by using a React SPA (Vite) that communicates over REST polling for operational panels and WebSocket exclusively for the chat interface. The recommended approach is a clearly separated `src/dashboard/` backend module and `dashboard/` Vite SPA at the repo root, connected via a `startDashboardServer()` call at the bottom of `src/index.ts`. This surfaces the full operator toolkit (chat, container status, scheduler, memory editor, logs, todos) without disrupting the existing message loop.

The most important architectural decision is to treat the dashboard's chat session as a virtual channel — registering a `web:dashboard` group in SQLite and injecting messages through the existing orchestrator rather than building a parallel agent runner. This reuses concurrency limits, session management, and IPC handling for free, and avoids the biggest failure mode: duplicate or corrupted sessions from two code paths trying to own the same group state. The stack is modern and fully compatible: React 19, Vite 8, Tailwind v4, shadcn/ui, TanStack Query, and raw `ws` with no Socket.IO overhead.

The two risks that must be addressed from day one are: (1) the HTTP server must be registered in the existing shutdown handler before any other work, or systemd restarts hang for 90 seconds; and (2) all dashboard DB queries must have explicit LIMIT clauses, since `better-sqlite3` is synchronous and slow queries block Telegram message delivery in the same event loop. Every other pitfall is medium severity and addressed within specific phases.

---

## Key Findings

### Recommended Stack

The stack is anchored on Vite 8 (Rolldown-powered, 10–30x faster builds) with React 19 and TypeScript, using the Tailwind v4 Vite plugin and shadcn/ui components copied into the repo — no framework coupling, full ownership of component code. On the backend, Express 5 (now the npm default) handles static file serving and REST routes; raw `ws` handles WebSocket on the same `http.Server` instance with no extra port. TanStack Query manages all server state on the frontend including polling intervals; Zustand handles ephemeral UI state.

See [STACK.md](STACK.md) for full version matrix, installation commands, and alternatives rationale.

**Core technologies:**
- React 19 + Vite 8: UI framework + build tool — fastest modern SPA stack, fully TypeScript-native
- TypeScript 5.7: shared types between `src/` backend and `dashboard/src/` frontend eliminate API contract bugs
- Tailwind v4 + shadcn/ui: zero-config styling + accessible components owned by the repo
- TanStack Query v5: REST polling with refetch intervals, loading/error states, mutation support
- Express 5 + ws 8: minimal HTTP + WebSocket server on one port, attaches to existing process
- Zustand v5: sidebar state, WebSocket connection status, ephemeral UI only

### Expected Features

Research confirms a clear two-tier structure: P1 features make the dashboard genuinely useful on day one; P2 features add after validation in daily use. A large set of tempting features (real-time log streaming, .env editor, auth, multi-group chat) are explicitly anti-features for this use case — they add complexity without benefit at single-user LAN scale.

See [FEATURES.md](FEATURES.md) for the full prioritisation matrix, dependency graph, and competitor comparison.

**Must have (table stakes):**
- Chat interface with WebSocket — the primary reason the dashboard exists
- Status overview panel — health at a glance: channels, containers, last error
- Container status per group — running/idle/stopped, elapsed time, quick actions
- Message history browser — search and paginate by group
- CLAUDE.md editor — per-group and global memory files; unique to NanoClaw
- Log viewer — last N lines, filter by level, 5s poll
- Group/channel registry — which groups are registered and connected
- Scheduled task list + todo board — read-only first

**Should have (competitive differentiators):**
- Scheduled task CRUD — create, pause, resume, delete from dashboard
- Claude usage display — session token usage and weekly reset countdown
- IPC activity feed — live trace of recent agent IPC events
- Scheduler next-run timeline — 24h preview of due tasks
- Group config editor — name, trigger settings, requiresTrigger flag

**Defer (v2+):**
- Container concurrency visualisation (5-slot queue bar)
- Bot pool status (Telegram agent team assignments)
- Per-group isolation detail panel

### Architecture Approach

The dashboard integrates as a new `src/dashboard/` module within the existing Node.js process. `src/dashboard/server.ts` creates an Express app, one `http.Server`, and a `WebSocketServer` sharing the same port. REST routes in `src/dashboard/routes/` call existing `db.ts`, `todo.ts`, and `task-scheduler.ts` functions directly — no abstraction layer, no second DB connection. The React SPA lives in a separate `dashboard/` Vite project at the repo root with its own `package.json` and `tsconfig.json`. In production, Express serves `dashboard/dist/`; in development, Vite's proxy forwards `/api` and `/ws` to Express. The only change to `src/index.ts` is a single `startDashboardServer()` call after DB init.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full component diagram, data flow diagrams, build pipeline config, and anti-patterns.

**Major components:**
1. `src/dashboard/server.ts` — HTTP server factory: Express + http.Server + WebSocketServer; mounts all routes; serves static files
2. `src/dashboard/routes/` — one Express Router per domain (groups, messages, tasks, todos, logs, memory, usage, actions)
3. `src/dashboard/ws-handler.ts` — WebSocket connection lifecycle; bridges browser chat to the existing orchestrator via `storeMessage()` and `onOutput` broadcast callback
4. `dashboard/` (repo root) — React + Vite SPA; separate compilation target; communicates via REST and WebSocket only

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for the full list with recovery strategies and a "looks done but isn't" checklist.

1. **HTTP server not in shutdown handler** — Store the `http.Server` instance and add `dashboardServer.close()` as the first line of the existing `shutdown()` function in `src/index.ts`. Failure means systemd restarts hang 90 seconds.
2. **Dashboard chat session collision with Telegram** — Use `jid: "web:dashboard"` (not `"dashboard"`). Telegram JIDs use `tg:` prefix; dashboard uses `web:` prefix. Inject messages via `queue.enqueue()`, not `getNewMessages()` polling, to guarantee serialization.
3. **better-sqlite3 synchronous reads blocking Telegram message loop** — Enforce hard LIMIT (50–100 rows) on every dashboard-facing DB query. Never do a full-table scan from an HTTP handler. Add index on `(chat_jid, timestamp)` for message history queries.
4. **Production SPA routing broken despite working dev proxy** — Express route order must be: API routes first, `express.static(distDir)` second, `app.get('*', sendFile('index.html'))` catch-all last. Verify this with a local production build before Phase 1 is considered done.
5. **CLAUDE.md path traversal** — Resolve the requested path and verify it falls under `groups/` and matches a registered group folder name before any file read or write. Reject `folder=../../.env` with a 400.

---

## Implications for Roadmap

Based on research, four phases are suggested, ordered by dependency depth and risk level.

### Phase 1: HTTP Server Foundation + SPA Scaffold

**Rationale:** Every other phase depends on the Express server existing and the Vite pipeline working end-to-end. Shutdown handler integration must happen at server creation, not retrofitted later. This phase has the lowest risk and produces visible, testable results quickly.

**Delivers:** Express + WS server wired into `src/index.ts`; two read-only REST endpoints (`/api/groups`, `/api/health`); React SPA scaffold with sidebar layout and one working panel; full Vite dev proxy and production build verified locally.

**Addresses:** Group/channel registry view (read-only), status overview skeleton.

**Avoids:** Shutdown handler pitfall (wired from day one), production static serving pitfall (verified before moving on), Vite WebSocket proxy misconfiguration.

### Phase 2: Operational Panels + Dashboard Chat

**Rationale:** With the server and SPA established, operational read panels are all independent REST endpoints calling existing functions. Dashboard chat is the highest-risk item (touches the message loop) and goes last within this phase, after the REST scaffolding proves the integration.

**Delivers:** Container status per group with quick actions; message history browser; log viewer; CLAUDE.md editor with path traversal guard; scheduled task list and todo board (read-only); dashboard chat channel registered as `web:dashboard` with WebSocket handler and orchestrator integration.

**Addresses:** All P1 table-stakes features from FEATURES.md.

**Avoids:** Chat session collision pitfall (`web:dashboard` JID), in-memory state snapshot pattern, React StrictMode duplicate WS connection, SQLite blocking (LIMIT constraints on all new endpoints).

### Phase 3: Write Operations + V1.x Features

**Rationale:** CRUD operations build on the read-only views from Phase 2. Operators will want to edit tasks and todos after validating the read-only views work correctly in daily use. Claude usage display requires a subprocess exec pattern; IPC activity feed requires filesystem polling — both are contained and independent.

**Delivers:** Scheduled task CRUD; Claude usage display with 60s cache; IPC activity feed (ring buffer of recent events); scheduler next-run timeline.

**Addresses:** P2 features from FEATURES.md.

**Avoids:** Unbounded subprocess spawning for usage endpoint (60s TTL cache, in-flight guard), log file byte-offset read pattern.

### Phase 4: Polish + Advanced Observability

**Rationale:** Once the dashboard is in daily use, low-value features that require additional observability instrumentation can be added without risk to core stability.

**Delivers:** Container concurrency visualisation (5-slot queue bar); Telegram bot pool status; per-group isolation detail panel; group config editor.

**Addresses:** P3/future features from FEATURES.md.

### Phase Ordering Rationale

- **Foundation before features:** The server and build pipeline must be proven before building panels on top. A Vite proxy that works in dev but a broken production static serve would invalidate all work done in later phases.
- **Read before write:** All CRUD operations follow their corresponding read-only views. This prevents operators from writing state they can't yet see, and surfaces data model issues before mutation endpoints are built.
- **Chat last in Phase 2:** Chat is the most important feature but also the highest-risk integration point (touches `src/index.ts` message loop). Establishing the REST pattern first reduces the blast radius if something goes wrong in the orchestrator integration.
- **Pitfall prevention is phase-gated:** Each pitfall maps explicitly to a phase. This means acceptance criteria for each phase should include the "looks done but isn't" checklist items from PITFALLS.md.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (dashboard chat integration):** The `onOutput` callback interception and `web:dashboard` JID registration interact with the message loop in a non-trivial way. Review `src/index.ts` message loop carefully before finalising the implementation plan. PITFALLS.md already documents the collision risk in detail.
- **Phase 3 (Claude usage CLI parsing):** The `claude /usage` output format is not officially documented. Needs empirical testing to determine the right parsing strategy.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Express + Vite setup is thoroughly documented with official sources. No research needed.
- **Phase 4:** Low-risk additions to existing patterns. No research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major versions verified against official sources and npm registry. Compatibility matrix explicitly confirmed (React 19 + Tailwind v4 + shadcn/ui). |
| Features | HIGH | Grounded in PROJECT.md requirements and verified against operator dashboard patterns. Competitor analysis confirms the P1/P2/P3 split. |
| Architecture | HIGH | Build order and data flow verified against Vite official docs and established Express + ws patterns. Anti-patterns backed by reasoning from NanoClaw source code. |
| Pitfalls | HIGH | Grounded directly in NanoClaw source inspection (`src/index.ts`, CONCERNS.md) and official library documentation. Not speculation. |

**Overall confidence:** HIGH

### Gaps to Address

- **`claude /usage` output format:** The CLI output format must be tested empirically before building the usage display endpoint. Cache strategy and parsing logic depend on actual output structure. Address in Phase 3 planning.
- **SQLite index coverage:** The existing `idx_timestamp` index may not be sufficient for dashboard message history queries filtering on `chat_jid`. Verify query plan with `EXPLAIN QUERY PLAN` during Phase 2 implementation and add a composite index `(chat_jid, timestamp)` if needed.
- **Dashboard port conflict with existing proxy:** NanoClaw already uses port 3000-range for its credential proxy. Confirm `DASHBOARD_PORT` default does not collide with the credential proxy port before Phase 1 integration.

---

## Sources

### Primary (HIGH confidence)
- [Vite 8.0 Official Docs](https://vite.dev/blog/announcing-vite8) — Rolldown, React/TS support, build config
- [React v19 Blog Post](https://react.dev/blog/2024/12/05/react-19) — stable API, concurrent features
- [shadcn/ui Tailwind v4 Docs](https://ui.shadcn.com/docs/tailwind-v4) — React 19 + Tailwind v4 compatibility confirmed
- [Express 5.1.0 npm default](https://expressjs.com/2025/03/31/v5-1-latest-release.html) — stable status
- [Tailwind CSS v4 Release](https://tailwindcss.com/blog/tailwindcss-v4) — zero-config Vite plugin
- [Vite backend integration docs](https://vite.dev/guide/backend-integration) — `ws: true` proxy requirement
- [Node.js Graceful Shutdown — Express docs](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html) — `server.close()` behavior
- NanoClaw `src/index.ts`, `docs/CODEBASE.md`, `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md` — direct source inspection

### Secondary (MEDIUM confidence)
- [Express vs Fastify 2025 — BetterStack](https://betterstack.com/community/guides/scaling-nodejs/fastify-express/) — comparative throughput analysis
- [ws vs Socket.IO — Dev.to](https://dev.to/alex_aslam/nodejs-websockets-when-to-use-ws-vs-socketio-and-why-we-switched-di9) — use-case comparison
- [shadcn/ui vs MUI 2025 — MakersDen](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra) — ecosystem comparison
- [Express + ws integration — BetterStack](https://betterstack.com/community/guides/scaling-nodejs/express-websockets/) — integration pattern
- [WebSocket connections in React — GetStream](https://getstream.io/blog/websocket-connections-react/) — StrictMode double-mount pattern
- [Avoiding Memory Leaks in Node.js — AppSignal](https://blog.appsignal.com/2020/05/06/avoiding-memory-leaks-in-nodejs-best-practices-for-performance.html) — setInterval cleanup

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
