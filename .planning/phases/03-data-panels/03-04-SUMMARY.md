---
phase: 03-data-panels
plan: 04
subsystem: ui
tags: [react, express, todos, dashboard, typescript]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Express dashboard server with /api routing pattern
  - phase: 02-operational-panels
    provides: Router factory pattern with factory functions returning Express Router

provides:
  - GET /api/todos returning { items: TodoItem[], projects: TodoProject[] } (all statuses)
  - TodosPanel React component with collapsible project sections and assignee filter

affects:
  - 03-05-plan (next panel, same phase)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "todosRouter() factory function — no deps needed, reads DB directly"
    - "Client-side filtering only — single fetch, all statuses returned, filter in React state"
    - "TDD RED/GREEN cycle — test written before route implementation"

key-files:
  created:
    - src/dashboard/routes/todos.ts
    - src/dashboard/routes/todos.test.ts
    - dashboard/src/components/TodosPanel.tsx
  modified:
    - src/dashboard/server.ts

key-decisions:
  - "Return ALL items (all statuses) from /api/todos — client filters to avoid multiple round-trips"
  - "Default view shows open items only; showAll toggle reveals done/cancelled without extra fetch"
  - "Assignee filter buttons toggle: clicking active filter clears it back to null (show all)"

patterns-established:
  - "Todos filter pattern: single API fetch, client-side status+assignee filter via React state"

requirements-completed:
  - TODO-01
  - TODO-02

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 3 Plan 04: Todos Panel Summary

**Todos board panel with GET /api/todos route and collapsible project sections, assignee filter, and subtask indentation in React**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T01:09:47Z
- **Completed:** 2026-03-16T01:12:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- REST route GET /api/todos returns all items across all statuses plus full project list
- TodosPanel component with collapsible sections, item count badges, and chevron toggle
- Client-side filtering: showAll toggle + Tristan/Deltron assignee filter buttons
- Subtasks rendered indented (pl-10) under their parent item with same badge layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Todos route (TDD)** - `de8ee21` (feat) — includes both test (RED) and implementation (GREEN)
2. **Task 2: Mount todosRouter + TodosPanel** - `fe8750a` (feat)

## Files Created/Modified
- `src/dashboard/routes/todos.ts` - GET /api/todos Express route, factory function
- `src/dashboard/routes/todos.test.ts` - 3 tests: shape, all-statuses, projects
- `dashboard/src/components/TodosPanel.tsx` - React panel with collapsible sections, filter, subtasks
- `src/dashboard/server.ts` - Added todosRouter import and mount at /api

## Decisions Made
- Return ALL items regardless of status from the API — client does the filtering. Avoids multiple round-trips when user toggles showAll or changes assignee filter.
- Default view is open-only for clarity; showAll toggle is a simple boolean in component state.
- Assignee filter is a toggle: clicking the active assignee button clears the filter (back to null/all).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
Pre-existing TypeScript errors in `src/dashboard/routes/tasks.test.ts` (untracked stub from a future plan) reference a `getTaskRunLogs` export not yet in `db.ts`. These are out-of-scope and logged to deferred-items.md. Dashboard TypeScript (`dashboard/tsconfig.json`) compiled cleanly.

## Next Phase Readiness
- TodosPanel component ready to be wired into App.tsx navigation (Plan 05)
- /api/todos endpoint live in dashboard server

---
*Phase: 03-data-panels*
*Completed: 2026-03-16*
