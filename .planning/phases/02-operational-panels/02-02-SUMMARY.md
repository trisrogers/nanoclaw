---
phase: 02-operational-panels
plan: "02"
subsystem: dashboard
tags: [dashboard, containers, rest-api, react, tdd]
dependency_graph:
  requires:
    - 02-01  # DashboardDeps interface + GroupQueue.getSnapshot()
  provides:
    - GET /api/containers endpoint returning group + container state
    - POST /api/containers/:folder/clear and /restart endpoints
    - ContainersPanel React component
  affects:
    - src/dashboard/types.ts  # DashboardDeps extended with 3 new fields
    - src/index.ts            # dashboardDeps object extended
    - src/dashboard/server.ts # containersRouter mounted
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN/REFACTOR)
    - Express Router factory with DashboardDeps injection
    - React inline-confirm pattern (ActionButton component)
    - usePoll hook with manual refresh counter for post-action refetch
key_files:
  created:
    - src/dashboard/routes/containers.ts
    - src/dashboard/routes/containers.test.ts
    - dashboard/src/components/ContainersPanel.tsx
  modified:
    - src/dashboard/types.ts   # +getRegisteredGroups, +clearGroupSession, +restartGroupContainer
    - src/dashboard/server.ts  # import + mount containersRouter
    - src/index.ts             # dashboardDeps extended with 3 new functions
    - dashboard/src/App.tsx    # +ContainersPanel import and conditional render
    - docs/CODEBASE.md         # updated to document containers route and panel
decisions:
  - title: "Restart = closeStdin only"
    rationale: "closeStdin signals the running container to wind down; next message automatically spins up a fresh container — no manual restart logic needed"
  - title: "Inline confirm pattern — no modal"
    rationale: "ActionButton component transforms to Confirm?/Cancel pair inline; avoids any modal/dialog overhead"
  - title: "usePoll refresh counter"
    rationale: "Added refresh counter to usePoll deps array so calling setRefresh() after an action triggers an immediate re-fetch without a separate fetch() call"
metrics:
  duration: ~3 min
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 8
---

# Phase 02 Plan 02: Containers Panel Summary

Containers route and UI panel delivering GET/POST /api/containers endpoints and a ContainersPanel React component with inline-confirm clear and restart actions.

## What Was Built

**Backend (src/dashboard/routes/containers.ts)**
- `containersRouter(deps)` factory — GET `/api/containers` merges `queue.getSnapshot()` with registered group names
- POST `/:folder/clear` — calls `clearGroupSession()` which does DB clear + in-memory session delete + `queue.closeStdin()`
- POST `/:folder/restart` — calls `restartGroupContainer()` which calls `queue.closeStdin()` only; next message brings fresh container
- Unknown folder returns 404 on all POST routes

**DashboardDeps extended (src/dashboard/types.ts + src/index.ts)**
- `getRegisteredGroups()` — returns `Record<string, RegisteredGroup>` for folder → name lookup
- `clearGroupSession(folder)` — reverse lookup by folder, then DB + memory + stdin close
- `restartGroupContainer(folder)` — reverse lookup by folder, then stdin close

**Frontend (dashboard/src/components/ContainersPanel.tsx)**
- Table with columns: Group | Container | Status | Elapsed | Actions
- Colour-coded status badges: Running (green), Idle (yellow), Stopped (gray)
- `ActionButton` component: idle state → click → Confirm?/Cancel pair; no modals
- 3-second inline toast feedback (green on success, red on error)
- Polls `/api/containers` every 10 seconds; re-fetches immediately after any action

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Test scaffold for /api/containers | f1af233 | containers.test.ts, types.ts |
| 1 (GREEN) | /api/containers route + deps wiring | 6e9d340 | containers.ts, server.ts, index.ts |
| 2 | ContainersPanel React component | c221820 | ContainersPanel.tsx, App.tsx |

## Verification

- All 7 containers.test.ts tests pass (GREEN)
- Full suite: 394 tests passing across 29 test files
- `npm run build:dashboard` — clean TypeScript compile, no errors
- No TypeScript errors in route or component

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] src/dashboard/routes/containers.ts created
- [x] src/dashboard/routes/containers.test.ts created
- [x] dashboard/src/components/ContainersPanel.tsx created
- [x] Commits f1af233, 6e9d340, c221820 present in git log
- [x] All 394 tests pass
- [x] Dashboard build clean
