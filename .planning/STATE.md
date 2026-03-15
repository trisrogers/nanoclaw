# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** You can see everything NanoClaw is doing and intervene without touching the terminal or opening Telegram.
**Current focus:** Phase 1 - Foundation

## Current Position

Phase: 1 of 3 (Foundation)
Plan: 1 of 5 in current phase
Status: In progress
Last activity: 2026-03-15 — Completed 01-01 (HTTP + WebSocket server)

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: ~45 min
- Total execution time: ~45 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1 | ~45 min | ~45 min |

**Recent Trend:**
- Last 5 plans: 01-01 (~45 min)
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Dashboard runs inside NanoClaw process (no separate service, direct DB access)
- Chat uses JID `web:dashboard` — never `tg:` or `gmail:` prefix (avoids session collision)
- WebSocket only for chat; all other panels use polling REST
- HTTP server MUST be added to shutdown handler in the same plan it is created (Phase 1, plan 01-01)
- All DB query endpoints need LIMIT clauses (better-sqlite3 is synchronous, blocks Telegram delivery)
- [01-01] dashboardServer.close() placed as FIRST call in shutdown() — prevents 90-second hang on systemctl restart
- [01-01] Server binds to 0.0.0.0 by default (DASHBOARD_BIND env var) — required for WSL host access
- [01-01] Static dist path resolved with process.cwd() not __dirname — required under systemd

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Phase 2 dashboard chat integration — review `src/index.ts` message loop before finalising 02-04 plan. The `onOutput` callback interception and `web:dashboard` JID registration interact with the message loop in a non-trivial way.
- Research flag: Phase 3 Claude usage CLI — `claude /usage` output format is undocumented. Needs empirical testing before building the parsing endpoint. Address in 03-05 plan.
- Verify `DASHBOARD_PORT` default (3030) does not conflict with the NanoClaw credential proxy (3001). Confirmed different ports but worth a runtime check.

## Session Continuity

Last session: 2026-03-15
Stopped at: Completed 01-01-PLAN.md (HTTP + WebSocket server, human-verified clean restart)
Resume file: None
