# NanoClaw Dashboard

## What This Is

A React SPA dashboard served from the NanoClaw Node.js process that lets you monitor and control NanoClaw from a browser. It exposes what's happening inside the system — active containers, message history, scheduled tasks, todos, logs — and lets you communicate with Deltron directly from the web UI with its own isolated session.

## Core Value

You can see everything NanoClaw is doing and intervene without touching the terminal or opening Telegram.

## Requirements

### Validated

<!-- Existing NanoClaw capabilities the dashboard will surface -->

- ✓ Multi-channel message routing (Telegram primary, Gmail) — existing
- ✓ SQLite storage: messages, sessions, tasks, todos, groups — existing
- ✓ Docker container agent execution per group — existing
- ✓ Scheduled task system (cron, interval, once) — existing
- ✓ Todo/task CRUD with projects, subtasks, reminders — existing
- ✓ Per-group isolation with CLAUDE.md memory files — existing
- ✓ IPC file-based agent communication — existing
- ✓ Pino structured JSON logging — existing
- ✓ Credential proxy (HTTP, port 3001) — existing

### Active

<!-- New dashboard requirements -->

- [ ] **DASH-01**: User can chat with Deltron from dashboard (isolated session, real-time via WebSocket)
- [ ] **DASH-02**: User can view container health per group (running/idle/stopped, live status)
- [ ] **DASH-03**: User can browse and search message history per group
- [ ] **DASH-04**: User can view registered groups and channel connection status
- [ ] **DASH-05**: User can create, edit, pause/resume, and delete scheduled tasks
- [ ] **DASH-06**: User can view agent activity logs (container stdout, error log, per group)
- [ ] **DASH-07**: User can view Claude Code Pro plan usage (session usage, weekly limit, reset time)
- [ ] **DASH-08**: User can view and manage todo items and task projects across all groups
- [ ] **DASH-09**: User can edit per-group and global CLAUDE.md memory files
- [ ] **DASH-10**: User can trigger quick actions (clear session, restart container, compact context)
- [ ] **DASH-11**: User can edit group config (name, trigger settings, requiresTrigger flag)
- [ ] **CONF-01**: Dashboard HTTP server starts with NanoClaw process on configurable port
- [ ] **CONF-02**: Dashboard is accessible on LAN with no authentication required

### Out of Scope

- Multi-user auth / login — single-user local tool, LAN trust model
- Mobile app / responsive mobile layout — desktop browser first
- Real-time streaming for logs/stats — polling is sufficient (chat is the only true real-time need)
- Editing .env credentials from dashboard — security risk
- External exposure / HTTPS — LAN only, user's responsibility to firewall
- Telegram message sending from dashboard — dashboard has its own session; Telegram remains Telegram
- File upload to agents — out of scope for v1

## Context

NanoClaw is a single Node.js/TypeScript process running as a systemd user service. It has no existing HTTP server beyond the credential proxy (port 3001). The dashboard will add a new HTTP server (e.g. port 3000) that serves the React SPA and exposes REST + WebSocket endpoints reading from the existing SQLite DB and in-memory state.

**Tech stack decisions:**
- Frontend: React + Vite + TypeScript (SPA, static files served by NanoClaw)
- Backend: New Express HTTP server + `ws` WebSocket server added to `src/index.ts`
- Chat channel: New registered group `dashboard` — messages injected via existing orchestrator flow
- Data: Dashboard reads SQLite DB directly (read-mostly) and writes via existing db.ts functions
- Claude usage: Parsed from `claude /usage` CLI output run on demand

**Codebase entry points relevant to dashboard:**
- `src/index.ts` — where HTTP server will be added
- `src/db.ts` — data source for all dashboard queries
- `src/todo.ts` — todo/task CRUD
- `src/task-scheduler.ts` — scheduled task management
- `store/messages.db` — SQLite database
- `groups/*/CLAUDE.md` — memory files for CLAUDE.md editor
- `logs/` — Pino JSON log files for activity feed

## Constraints

- **Tech stack**: Node.js + TypeScript backend, React + Vite frontend — no new languages or runtimes
- **Process model**: Dashboard runs inside the existing NanoClaw process — no separate dashboard service
- **Port**: Dashboard HTTP server on configurable port (default 3000), does not conflict with credential proxy (3001)
- **No breaking changes**: Dashboard is additive — existing Telegram/Gmail channels unaffected
- **LAN access**: Binds to `0.0.0.0` (or configurable) — not localhost-only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dashboard runs inside NanoClaw process | Avoids separate service, has direct DB access, simpler deployment | — Pending |
| Chat uses its own NanoClaw session | Isolates dashboard conversations from Telegram; clean separation of contexts | — Pending |
| React + Vite for frontend | TypeScript consistency, fast dev, fits team's stack, good component ecosystem | — Pending |
| No auth for v1 | Single-user, LAN-only tool; auth adds friction with no real security gain on home network | — Pending |
| WebSocket only for chat | All other panels poll — avoids WebSocket complexity for data that doesn't need push | — Pending |

---
*Last updated: 2026-03-15 after initialization*
