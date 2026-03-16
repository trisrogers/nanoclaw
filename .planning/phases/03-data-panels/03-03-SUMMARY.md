---
phase: 03-data-panels
plan: "03"
subsystem: dashboard
tags: [scheduled-tasks, rest-api, react, sqlite, tdd]
dependency_graph:
  requires: []
  provides: [getTaskRunLogs, tasksRouter, TasksPanel]
  affects: [src/db.ts, src/dashboard/server.ts]
tech_stack:
  added: []
  patterns: [factory-router, lazy-fetch-cache, tdd-red-green]
key_files:
  created:
    - src/dashboard/routes/tasks.ts
    - src/dashboard/routes/tasks.test.ts
    - dashboard/src/components/TasksPanel.tsx
  modified:
    - src/db.ts
    - src/dashboard/server.ts
    - src/db.test.ts
decisions:
  - getTaskRunLogs uses Math.min(limit, 20) hard cap — run logs accumulate indefinitely, cap prevents blocking the event loop
  - GET /api/tasks/:id/runs returns empty array for unknown task ID (not 404) — no logs is a valid state
  - RunLogsRow fetches lazily on first expand and caches result per task ID in local state — avoids re-fetching on collapse/expand
metrics:
  duration_minutes: 4
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_changed: 5
---

# Phase 3 Plan 03: Scheduled Tasks Panel Summary

**One-liner:** Expandable tasks table with lazy-loaded run history via getTaskRunLogs DB function and GET /api/tasks/:id/runs REST endpoint.

## What Was Built

Added the Scheduled Tasks data panel: a DB query function, two REST endpoints, and a React component.

- `getTaskRunLogs(taskId, limit=20)` in `src/db.ts` — queries `task_run_logs` ordered by `run_at DESC`, hard-capped at 20 rows via `Math.min`
- `tasksRouter()` in `src/dashboard/routes/tasks.ts` — factory function returning an Express Router with `GET /tasks` and `GET /tasks/:id/runs`
- `TasksPanel.tsx` — table with chevron-toggled expandable rows; fetches run history lazily on first expand and caches it

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add getTaskRunLogs DB function + tasks route | 4e561b5 | src/db.ts, src/dashboard/routes/tasks.ts, src/dashboard/routes/tasks.test.ts, src/db.test.ts |
| 2 | Mount tasksRouter + TasksPanel component | 5bc72db | src/dashboard/server.ts, dashboard/src/components/TasksPanel.tsx |

## Verification

- All 35 tests pass (7 new getTaskRunLogs tests in db.test.ts, 4 new tasks route tests)
- `npx tsc --noEmit` — clean
- `npx tsc --project dashboard/tsconfig.json --noEmit` — clean
- `getTaskRunLogs` exported from `src/db.ts` with hard cap at 20
- `tasksRouter` mounted in `server.ts`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
