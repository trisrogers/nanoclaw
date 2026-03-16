---
phase: 03-data-panels
plan: 01
subsystem: ui
tags: [react, express, sqlite, better-sqlite3, tdd, pagination, search]

requires:
  - phase: 02-operational-panels
    provides: dashboard server with logsRouter pattern and registered groups API

provides:
  - getMessagesByGroup() paginated+search DB query exported from src/db.ts
  - getTaskRunLogs() DB query for task run history (also used by plan 03-03)
  - GET /api/messages?group=&page=&search= REST route returning { messages, total, page, pages }
  - MessagesPanel.tsx React component with group sidebar, chat bubbles, search, pagination
affects: [03-03-tasks-panel, 03-05-integration]

tech-stack:
  added: []
  patterns:
    - messagesRouter follows logsRouter factory function pattern (no DashboardDeps, reads DB directly)
    - Composite index idx_messages_jid_ts on messages(chat_jid, timestamp DESC) for pagination performance
    - getMessagesByGroup uses spread params for better-sqlite3 variadic .get()/.all() calls

key-files:
  created:
    - src/db.ts (getMessagesByGroup, getTaskRunLogs, MessageRow interface)
    - src/dashboard/routes/messages.ts
    - src/dashboard/routes/messages.test.ts
    - dashboard/src/components/MessagesPanel.tsx
  modified:
    - src/db.ts (added composite index, new query functions)
    - src/dashboard/server.ts (added messagesRouter import and mount)
    - src/db.test.ts (added getMessagesByGroup and getTaskRunLogs test suites)

key-decisions:
  - "Composite index idx_messages_jid_ts covers the exact query shape used by getMessagesByGroup (chat_jid = ? ORDER BY timestamp DESC)"
  - "messagesRouter uses pageSize=50 hardcoded in route layer for pages calculation, matching DB default"
  - "MessagesPanel fetches from /api/groups for group list rather than duplicating group state"
  - "300ms debounce on search input to avoid per-keystroke API requests"

patterns-established:
  - "Route layer: pages = Math.max(1, Math.ceil(total / pageSize)) — prevents 0 pages when total=0"
  - "DB query: spread params [...baseParams, LIMIT, OFFSET] works for both search and non-search variants"

requirements-completed: [MSG-01, MSG-02]

duration: 7min
completed: 2026-03-16
---

# Phase 3 Plan 01: Message History Panel Summary

**Paginated, searchable chat bubble history panel with group sidebar, per-group SQLite query, and Express REST route**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-16T01:09:34Z
- **Completed:** 2026-03-16T01:16:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `getMessagesByGroup()` with pagination (50/page) and LIKE search, plus composite DB index for performance
- Added `getTaskRunLogs()` to satisfy pre-existing test expectations in db.test.ts (also needed by plan 03-03)
- Created `GET /api/messages` route returning `{ messages, total, page, pages }` with 400 on missing group
- Built `MessagesPanel.tsx` (206 lines) with group sub-nav, chat bubbles matching ChatPanel CSS, debounced search, and pagination controls

## Task Commits

1. **Task 1: Add getMessagesByGroup DB query + route** - `0ed6736` (feat, TDD)
2. **Task 2: Mount messagesRouter in server.ts** - `217c77c` (feat)
3. **Task 3: MessagesPanel React component** - `bc116a4` (feat)

## Files Created/Modified

- `src/db.ts` - Added composite index, `MessageRow` interface, `getMessagesByGroup()`, `getTaskRunLogs()`
- `src/dashboard/routes/messages.ts` - New file: `messagesRouter()` factory, GET /messages handler
- `src/dashboard/routes/messages.test.ts` - New file: 3 route tests (400 on missing group, valid response, search forwarding)
- `src/db.test.ts` - Added `getMessagesByGroup` (5 tests) and `getTaskRunLogs` (3 tests) describe blocks
- `src/dashboard/server.ts` - Added `messagesRouter` import and mount
- `dashboard/src/components/MessagesPanel.tsx` - New file: 206-line React component

## Decisions Made

- `getTaskRunLogs` added alongside `getMessagesByGroup` because db.test.ts already imported it (pre-existing tests from an earlier session were referencing it). Adding it now keeps all tests green and it's needed by plan 03-03 anyway.
- Composite index `idx_messages_jid_ts ON messages(chat_jid, timestamp DESC)` added inside `CREATE TABLE` block (idempotent via `IF NOT EXISTS`) rather than as a migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added getTaskRunLogs to satisfy pre-existing test imports**
- **Found during:** Task 1 (DB query implementation)
- **Issue:** db.test.ts already imported `getTaskRunLogs` and `logTaskRun` and had 3 test cases for it. The function was not yet implemented in db.ts, causing 3 test failures.
- **Fix:** Added `getTaskRunLogs(taskId, limit=20)` to db.ts returning task_run_logs rows in DESC order.
- **Files modified:** src/db.ts
- **Verification:** All 34 tests pass including the 3 getTaskRunLogs tests
- **Committed in:** `0ed6736` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Necessary addition — pre-existing test infrastructure required it, and the function is referenced by plan 03-03. No scope creep.

## Issues Encountered

None — all verification steps passed first time.

## Next Phase Readiness

- `GET /api/messages` route live and tested, ready for integration
- `MessagesPanel.tsx` created but not yet wired into `App.tsx` navigation — plan 03-05 handles that
- `getTaskRunLogs` now available for plan 03-03 (Tasks panel)

---
*Phase: 03-data-panels*
*Completed: 2026-03-16*
