# Roadmap: NanoClaw Dashboard

## Overview

Three phases build the dashboard from nothing to a fully functional operator control panel. Phase 1 establishes the Express HTTP server, React/Vite SPA scaffold, and the critical shutdown handler integration — the foundation every other phase depends on. Phase 2 delivers the core operational panels (overview, chat, container status, logs, groups) that make the dashboard immediately useful day-to-day. Phase 3 completes the data and management panels (message history, CLAUDE.md editor, scheduled tasks, todos, Claude usage) to round out v1.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Express HTTP server + React/Vite SPA scaffold wired into the NanoClaw process (completed 2026-03-15)
- [ ] **Phase 2: Operational Panels** - Chat, container status, overview, groups/channels, and logs panels
- [ ] **Phase 3: Data Panels** - Message history, CLAUDE.md editor, scheduled tasks, todos, and Claude usage panels

## Phase Details

### Phase 1: Foundation
**Goal**: The dashboard HTTP server runs inside NanoClaw, serves a React SPA, and the full dev/prod build pipeline is verified end-to-end
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06
**Success Criteria** (what must be TRUE):
  1. Visiting `http://<host>:3030` in a browser loads the React SPA (sidebar layout with at least one placeholder panel)
  2. The NanoClaw process shuts down cleanly under SIGTERM with no 90-second hang (HTTP server closed in shutdown handler)
  3. The Vite dev server proxies `/api` and `/ws` requests to the backend — `npm run dev` inside `dashboard/` works without CORS errors
  4. A production build (`npm run build`) produces a `dashboard/dist/` that Express serves correctly, including SPA route fallback
  5. The dashboard is reachable from another machine on the LAN (bound to `0.0.0.0`, not `127.0.0.1`)
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Express + ws backend server, shutdown handler integration, unit tests (INFRA-01, INFRA-03, INFRA-04, INFRA-05)
- [ ] 01-02-PLAN.md — React/Vite SPA scaffold with sidebar layout, /api/groups endpoint, production build pipeline verified (INFRA-02, INFRA-06)

### Phase 2: Operational Panels
**Goal**: Users can monitor NanoClaw's live state and chat with Deltron from the browser without touching the terminal
**Depends on**: Phase 1
**Requirements**: OVER-01, OVER-02, CHAT-01, CHAT-02, CHAT-03, CHAT-04, OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, GRP-01, GRP-02
**Success Criteria** (what must be TRUE):
  1. User can send a message to Deltron from the dashboard and receive a response in real-time via WebSocket, with a typing indicator while processing
  2. Dashboard chat session uses JID `web:dashboard` and its history never appears in any Telegram group or other channel
  3. User can see container status (running / idle / stopped with elapsed time) for every group, and can clear a session or restart a container with a confirmation prompt
  4. User can view the last 200 lines of Pino logs with level filtering, refreshing automatically every 5 seconds
  5. User can see all registered groups and channels with their JID, isMain status, and connection state, plus a status overview showing channels connected, active containers, pending tasks, and last error
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — DashboardDeps injection + /api/stats + /api/channels + OverviewPanel + GroupsPanel (OVER-01, OVER-02, GRP-01, GRP-02)
- [ ] 02-02-PLAN.md — /api/containers route + ContainersPanel with inline-confirm actions (OPS-01, OPS-02, OPS-03)
- [ ] 02-03-PLAN.md — /api/logs route + LogsPanel with level filter and smart auto-scroll (OPS-04, OPS-05)
- [ ] 02-04-PLAN.md — WebDashboardChannel + chat handler + ChatPanel messenger UI (CHAT-01, CHAT-02, CHAT-03, CHAT-04)

### Phase 3: Data Panels
**Goal**: Users can inspect historical data and edit NanoClaw configuration from the dashboard
**Depends on**: Phase 2
**Requirements**: MSG-01, MSG-02, MEM-01, MEM-02, MEM-03, TASK-01, TASK-02, TODO-01, TODO-02, USAGE-01, USAGE-02
**Success Criteria** (what must be TRUE):
  1. User can browse message history per group with 50-message pages and search by text content
  2. User can view and save the global `groups/global/CLAUDE.md` and any per-group `CLAUDE.md` file, and is warned before navigating away with unsaved changes
  3. User can view all scheduled tasks with schedule, last run, next run, and status, plus the last 20 runs per task including output and errors
  4. User can view all todo items grouped by project with status, due dates, and assignee visible across all groups
  5. User can view Claude Code Pro usage on demand (session usage, weekly limit, reset time) with a 60-second cache preventing repeated CLI invocations
**Plans**: TBD

Plans:
- [ ] 03-01: Message history panel (paginated + search, LIMIT enforced, composite index verified) (MSG-01, MSG-02)
- [ ] 03-02: CLAUDE.md editor panel (global + per-group, path traversal guard) (MEM-01 through MEM-03)
- [ ] 03-03: Scheduled tasks panel (list + run history) (TASK-01, TASK-02)
- [ ] 03-04: Todos board panel (all groups, grouped by project) (TODO-01, TODO-02)
- [ ] 03-05: Claude usage panel (on-demand CLI parse, 60s TTL cache) (USAGE-01, USAGE-02)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-15 |
| 2. Operational Panels | 0/4 | Not started | - |
| 3. Data Panels | 0/5 | Not started | - |
