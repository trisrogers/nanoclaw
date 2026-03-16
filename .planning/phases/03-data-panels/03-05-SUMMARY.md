---
phase: 03-data-panels
plan: 05
subsystem: ui
tags: [react, express, typescript, vitest, oauth, usage-api]

# Dependency graph
requires:
  - phase: 03-data-panels
    provides: "MessagesPanel, MemoryPanel (with memoryIsDirtyRef export), TasksPanel, TodosPanel from plans 01-04"
  - phase: 02-operational-panels
    provides: "DashboardDeps, server.ts factory pattern, router factory convention"
provides:
  - "GET /api/usage endpoint with 60s TTL cache (Anthropic OAuth API + stats-cache.json fallback)"
  - "UsagePanel React component with refresh button and raw display"
  - "App.tsx wired with all 5 Phase 3 panels replacing 'Panel coming soon' placeholders"
  - "memoryIsDirtyRef navigation guard on all sidebar nav clicks"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Usage route reads stats-cache.json (written by claude CLI) for offline-capable quota display"
    - "Anthropic OAuth API (/api/usage/activity) as primary source with stats-cache.json as fallback"
    - "60s TTL cache on usage endpoint — prevents CLI respawn on rapid refreshes"
    - "All 5 new panels wired via explicit conditional renders in App.tsx (no catch-all fallback)"

key-files:
  created:
    - src/dashboard/routes/usage.ts
    - src/dashboard/routes/usage.test.ts
    - dashboard/src/components/UsagePanel.tsx
  modified:
    - src/dashboard/server.ts
    - dashboard/src/App.tsx

key-decisions:
  - "Usage route reads stats-cache.json from claude data dir rather than spawning claude /usage CLI — more reliable, no PATH dependency"
  - "Anthropic OAuth API (/api/usage/activity) queried for real quota data; stats-cache.json used as fallback"
  - "memoryIsDirtyRef checked in handleNavClick in App.tsx — all nav item clicks go through single guard"
  - "All 5 panels rendered via explicit conditionals in App.tsx — old catch-all 'Panel coming soon' block removed"

patterns-established:
  - "Usage route: read stats-cache.json → parse JSON → merge with Anthropic API data → cache 60s"
  - "Navigation dirty guard: exported ref from child component, checked in parent setActive wrapper"

requirements-completed: [USAGE-01, USAGE-02]

# Metrics
duration: ~30min (continuation from checkpoint)
completed: 2026-03-16
---

# Phase 3 Plan 05: Usage Panel and App.tsx Wiring Summary

**Claude OAuth quota panel with 60s cache via stats-cache.json + Anthropic API, all 5 Phase 3 panels wired into App.tsx with memory dirty guard**

## Performance

- **Duration:** ~30 min (continuation after human-verify checkpoint)
- **Started:** 2026-03-16
- **Completed:** 2026-03-16
- **Tasks:** 3 (including checkpoint)
- **Files modified:** 5

## Accomplishments
- Usage route reads claude's `stats-cache.json` (reliable, no PATH dependency) and merges with Anthropic OAuth API for real quota data
- UsagePanel component displays session/weekly quota with refresh button and raw JSON fallback display
- App.tsx updated to render all 5 Phase 3 panels (Messages, Memory, Tasks, Todos, Usage) via explicit conditionals
- Memory dirty-guard wired into App.tsx `handleNavClick` — confirms before navigating away from unsaved edits
- All 5 panels verified live in the dashboard by user

## Task Commits

Each task was committed atomically:

1. **Task 1: Usage route with 60s TTL cache (TDD)** - `148368e` (test), `cf7c985` (feat), `0466563` (feat - OAuth API)
2. **Task 2: UsagePanel component + mount route + wire App.tsx** - `4183ac6` (feat)
3. **Task 3: Verify all Phase 3 panels in live dashboard** - human-verify checkpoint (approved by user)

## Files Created/Modified
- `src/dashboard/routes/usage.ts` - GET /api/usage with 60s TTL; reads stats-cache.json + Anthropic OAuth API
- `src/dashboard/routes/usage.test.ts` - Vitest tests for cache TTL, ENOENT, non-zero exit
- `dashboard/src/components/UsagePanel.tsx` - React component with refresh button, labeled rows, raw pre block
- `src/dashboard/server.ts` - usageRouter() mounted at /api
- `dashboard/src/App.tsx` - All 5 panels wired; handleNavClick with memoryIsDirtyRef guard

## Decisions Made
- Usage route evolved from `claude /usage` CLI spawn (original plan) to reading `stats-cache.json` then calling Anthropic OAuth API — more reliable and doesn't require claude in PATH
- `memoryIsDirtyRef` checked in a single `handleNavClick` wrapper in App.tsx rather than per-item onClick — cleaner and covers all navigation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Usage route pivoted from CLI spawn to stats-cache.json + Anthropic API**
- **Found during:** Task 1 (TDD implementation)
- **Issue:** `claude /usage` CLI output format is undocumented and varies; spawning the process is fragile and PATH-dependent
- **Fix:** Route reads `~/.claude/statsCache.json` (written by claude CLI itself) for offline data, then queries Anthropic `https://api.anthropic.com/api/usage/activity` for real quota counts using the stored OAuth token
- **Files modified:** src/dashboard/routes/usage.ts
- **Verification:** Tests pass; route returns valid JSON in live dashboard
- **Committed in:** `cf7c985`, `0466563`

---

**Total deviations:** 1 auto-adapted (Rule 1 - implementation approach changed for reliability)
**Impact on plan:** Better outcome — more reliable than CLI spawn, surfaces real-time OAuth quota data.

## Issues Encountered
- The `claude /usage` CLI command output format was undocumented (noted as a research flag in STATE.md). Resolved by reading stats-cache.json directly and complementing with the Anthropic API.

## User Setup Required
None - no external service configuration required. OAuth token already stored at `~/.claude/` by the claude CLI.

## Next Phase Readiness
- Phase 3 complete — all 5 data panels are live in the dashboard
- All Phase 3 SUMMARY.md files exist for context assembly
- No blockers for any future phase

---
*Phase: 03-data-panels*
*Completed: 2026-03-16*
