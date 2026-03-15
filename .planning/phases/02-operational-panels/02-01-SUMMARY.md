---
phase: 02-operational-panels
plan: "01"
subsystem: ui
tags: [react, express, typescript, dashboard, rest-api, dependency-injection]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Dashboard HTTP server (startDashboardServer), /api/groups endpoint, Vite SPA shell
provides:
  - DashboardDeps interface with dependency injection pattern used by all Phase 2 plans
  - GET /api/stats endpoint returning 5 live metrics
  - GET /api/channels endpoint returning channel connection status
  - OverviewPanel React component (5 stat cards + groups/channels tables, 10s polling)
  - GroupsPanel React component (dedicated groups + channels tables, 10s polling)
  - GroupQueue.getSnapshot() method for container observability
affects:
  - 02-02-containers
  - 02-03-logs
  - 02-04-chat
  - 02-05-messages

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DashboardDeps factory function passed to startDashboardServer — all deps injected, no module-level globals
    - statsRouter/channelsRouter as factory functions accepting DashboardDeps — testable without DB
    - usePoll<T> hook inline in components — fetch + setInterval with cleanup and cancel guard
    - TDD Red/Green cycle — failing test stubs committed before implementation

key-files:
  created:
    - src/dashboard/types.ts
    - src/dashboard/routes/stats.ts
    - src/dashboard/routes/channels.ts
    - src/dashboard/routes/stats.test.ts
    - src/dashboard/routes/channels.test.ts
    - dashboard/src/components/OverviewPanel.tsx
    - dashboard/src/components/GroupsPanel.tsx
  modified:
    - src/group-queue.ts
    - src/dashboard/server.ts
    - src/dashboard/server.test.ts
    - src/index.ts
    - dashboard/src/App.tsx

key-decisions:
  - "DashboardDeps interface with factory functions (getChannels, getQueueSnapshot, etc.) injected into startDashboardServer — avoids module-level state, enables test isolation"
  - "statsRouter and channelsRouter are factory functions returning Express Router — deps passed at construction, fully testable with mock objects"
  - "IPC queue depth computed inline in index.ts by scanning data/ipc/<group>/input|messages — no additional DB columns needed"
  - "getLastError parses last 500 lines of logs/nanoclaw.log for ERROR/FATAL lines — read-only, no impact on log pipeline"
  - "dashboardDeps stored as module-scoped let in server.ts for future WebSocket chat handler (02-04) access"

patterns-established:
  - "Route factories: export function xRouter(deps: DashboardDeps): Router — always factory, never singleton"
  - "usePoll<T>(url, intervalMs) hook: fetch immediately then setInterval; cancel on unmount with cancelled flag"
  - "Stat card fullWidth prop: col-span-2 for the last error card spanning both columns"

requirements-completed: [OVER-01, OVER-02, GRP-01, GRP-02]

# Metrics
duration: 10min
completed: 2026-03-16
---

# Phase 2 Plan 01: DashboardDeps Injection + Overview and Groups Panels Summary

**DashboardDeps injection pattern with /api/stats + /api/channels REST endpoints and OverviewPanel (5 stat cards, 10s refresh) + GroupsPanel React components**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-16T08:45:12Z
- **Completed:** 2026-03-16T08:52:00Z
- **Tasks:** 3 (Task 1 TDD Red, Task 2 TDD Green, Task 3 React panels)
- **Files modified:** 10

## Accomplishments
- DashboardDeps interface established as the dependency injection contract for all Phase 2 plans
- GET /api/stats returns live 5-key snapshot (channels, containers, IPC queue, todos, last error) with no extra DB columns
- GET /api/channels returns channel name + connection status array
- OverviewPanel shows 5 stat cards in a 2-column grid with automatic 10-second refresh
- GroupsPanel delivers a dedicated groups + channels tables view
- GroupQueue.getSnapshot() exposes container observability without breaking existing queue logic
- All 381 tests pass; dashboard build clean at 201 KB

## Task Commits

Each task was committed atomically:

1. **Task 1: DashboardDeps + server refactor + test scaffolds (RED)** - `3225881` (test)
2. **Task 2: /api/stats and /api/channels routes (GREEN)** - `1e4c388` (feat)
3. **Task 3: Overview and Groups React panels** - `35543ca` (feat)

## Files Created/Modified
- `src/dashboard/types.ts` - DashboardDeps and ContainerSnapshot interfaces
- `src/dashboard/routes/stats.ts` - statsRouter factory for GET /api/stats
- `src/dashboard/routes/channels.ts` - channelsRouter factory for GET /api/channels
- `src/dashboard/routes/stats.test.ts` - Tests: shape validation + mock value propagation
- `src/dashboard/routes/channels.test.ts` - Tests: array shape + empty state
- `src/group-queue.ts` - Added startedAt tracking and public getSnapshot() method
- `src/dashboard/server.ts` - Added DashboardDeps parameter, mount stats/channels routers
- `src/dashboard/server.test.ts` - Updated to pass mockDeps in all test cases
- `src/index.ts` - Built DashboardDeps object with inline getIpcQueueDepth/getTodosDueToday/getLastError
- `dashboard/src/components/OverviewPanel.tsx` - Stats grid + groups/channels tables with usePoll
- `dashboard/src/components/GroupsPanel.tsx` - Dedicated groups/channels tables with usePoll
- `dashboard/src/App.tsx` - Route Overview/Groups/Logs to their panel components

## Decisions Made
- DashboardDeps factory functions injected at server startup — enables test isolation without mocking modules
- statsRouter/channelsRouter as factories rather than singletons — avoids shared state between test runs
- IPC queue depth scanned from filesystem in index.ts — no schema changes needed
- dashboardDeps stored as module-scoped let in server.ts — available to WebSocket handler in plan 02-04

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated server.test.ts to pass mockDeps to match new signature**
- **Found during:** Task 1 (server.ts refactor)
- **Issue:** Existing server.test.ts called startDashboardServer(0, '0.0.0.0') without deps — would fail TypeScript compilation after the signature change
- **Fix:** Added mockDeps constant and passed it to all 5 test invocations
- **Files modified:** src/dashboard/server.test.ts
- **Verification:** All server tests continue to pass
- **Committed in:** 3225881 (Task 1 commit)

**2. [Rule 1 - Bug] Discovered pre-existing logsRouter in server.ts**
- **Found during:** Task 1 (first read of server.ts)
- **Issue:** server.ts had already been modified (between plan creation and execution) to include a logsRouter import and mount — the plan didn't mention it
- **Fix:** Preserved the existing logsRouter mount; added stats/channels routers before it as planned
- **Files modified:** src/dashboard/server.ts
- **Verification:** Logs endpoint still works; all tests pass
- **Committed in:** 1e4c388 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 signature compatibility, 1 pre-existing state)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None - plan executed cleanly after noting pre-existing logsRouter.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DashboardDeps interface is stable and exported — plans 02-02 through 02-05 can import and extend it
- GroupQueue.getSnapshot() available — 02-02 (Containers panel) can use it directly
- statsRouter/channelsRouter pattern established for remaining route plans
- All existing tests pass, no regressions

## Self-Check: PASSED

All key files exist and all task commits verified on disk.

| Check | Result |
|-------|--------|
| src/dashboard/types.ts | FOUND |
| src/dashboard/routes/stats.ts | FOUND |
| src/dashboard/routes/channels.ts | FOUND |
| dashboard/src/components/OverviewPanel.tsx | FOUND |
| dashboard/src/components/GroupsPanel.tsx | FOUND |
| Commit 3225881 (RED test stubs) | FOUND |
| Commit 1e4c388 (routes GREEN) | FOUND |
| Commit 35543ca (React panels) | FOUND |

---
*Phase: 02-operational-panels*
*Completed: 2026-03-16*
