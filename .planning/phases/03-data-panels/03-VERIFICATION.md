---
phase: 03-data-panels
verified: 2026-03-16T20:42:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "USAGE-02: usage.test.ts rewritten to mock fs/promises.readFile and globalThis.fetch — all 5 tests now pass"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open http://localhost:3030 and click each of Messages, Memory, Tasks, Todos, Usage in the sidebar"
    expected: "All 5 panels render real data with no 'Panel coming soon' text; Memory dirty guard fires confirm dialog on nav away with unsaved edits; Usage shows quota info or a graceful error message"
    why_human: "Visual layout, real data rendering, and confirm dialog behaviour cannot be verified programmatically"
---

# Phase 3: Data Panels Verification Report

**Phase Goal:** Add five data panels to the dashboard — Messages, Memory (CLAUDE.md editor), Tasks, Todos, and Usage — so users can inspect and manage NanoClaw state entirely from the browser.
**Verified:** 2026-03-16T20:42:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure

---

## Re-Verification Summary

Previous status: `gaps_found` (10/11), score 10/11.

**Gap closed:** `usage.test.ts` has been rewritten to match the actual implementation. The old tests mocked `child_process.spawn`; the new tests mock `fs/promises.readFile` (for credentials) and `globalThis.fetch` (for the Anthropic OAuth API call). All 5 usage route tests now pass.

**Regressions:** None. All 18 previously-passing route tests (messages, memory, tasks, todos) continue to pass. Both backend and frontend TypeScript compile clean.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User can select a group and see paginated chat history as bubbles | VERIFIED | MessagesPanel.tsx — group sidebar, chat bubbles with is_bot_message alignment, pagination |
| 2 | User can paginate through history 50 messages per page | VERIFIED | getMessagesByGroup uses pageSize=50; pages calculation in route; Prev/Next buttons in component |
| 3 | User can search message history by text within a group | VERIFIED | 300ms debounced search in MessagesPanel; search param forwarded to /api/messages; LIKE query in DB |
| 4 | User can view and edit global and per-group CLAUDE.md from the browser | VERIFIED | GET+PUT /api/memory/:group with resolveMemoryPath guard; MemoryPanel textarea + save button |
| 5 | User is warned before navigating away with unsaved changes | VERIFIED | beforeunload handler in MemoryPanel; window.confirm on group change; handleNavClick guard in App.tsx |
| 6 | User can see all scheduled tasks with schedule, last run, next run, status | VERIFIED | TasksPanel renders table with all columns; fetches /api/tasks on mount |
| 7 | User can click a task row to expand inline run history (last 20 runs) | VERIFIED | toggleRow() expands RunLogsRow; lazy-fetches /api/tasks/:id/runs; caches per task ID |
| 8 | User can see all todo items grouped by project with assignee filter | VERIFIED | TodosPanel with collapsible sections, Tristan/Deltron filter buttons, subtask indentation |
| 9 | User can view Claude usage data from the dashboard | VERIFIED | UsagePanel fetches /api/usage; shows five_hour, seven_day, extra_usage with progress bars |
| 10 | Usage data is cached for 60 seconds | VERIFIED | CACHE_TTL_MS = 60_000 in usage.ts; cache guard on every GET /usage handler |
| 11 | Usage route tests verify caching and error handling | VERIFIED | All 5 tests pass — cache hit, cache miss, ENOENT, API non-ok, correct Authorization header |

**Score:** 11/11 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/db.ts` | getMessagesByGroup() + getTaskRunLogs() exports | VERIFIED | Both functions present, tested, capped correctly |
| `src/dashboard/routes/messages.ts` | GET /api/messages with group/page/search | VERIFIED | messagesRouter() factory, 400 on missing group |
| `src/dashboard/routes/memory.ts` | GET+PUT /api/memory/:group with path traversal guard | VERIFIED | resolveMemoryPath with global special-case and knownFolders allowlist |
| `src/dashboard/routes/tasks.ts` | GET /api/tasks + GET /api/tasks/:id/runs | VERIFIED | tasksRouter() factory, both routes present |
| `src/dashboard/routes/todos.ts` | GET /api/todos returning items + projects | VERIFIED | todosRouter() factory, listTodos() + listProjects() called |
| `src/dashboard/routes/usage.ts` | GET /api/usage with 60s TTL cache | VERIFIED | Anthropic OAuth API, 60s cache, error-safe (never 500) |
| `dashboard/src/components/MessagesPanel.tsx` | Chat bubble panel with sidebar, pagination, search | VERIFIED | Substantive, wired to /api/messages and /api/groups |
| `dashboard/src/components/MemoryPanel.tsx` | CLAUDE.md editor with unsaved-changes guard | VERIFIED | memoryIsDirtyRef exported, beforeunload + confirm guard |
| `dashboard/src/components/TasksPanel.tsx` | Expandable task table with run history | VERIFIED | Lazy-loaded runs per task |
| `dashboard/src/components/TodosPanel.tsx` | Collapsible project sections with assignee filter | VERIFIED | Subtask indentation, filter buttons |
| `dashboard/src/components/UsagePanel.tsx` | Claude usage display with error fallback | VERIFIED | Progress bars, Refresh button, error banner |
| `dashboard/src/App.tsx` | All 5 panels wired, memoryIsDirtyRef guard | VERIFIED | All 5 panels in explicit conditionals; handleNavClick with dirty guard; no "coming soon" fallback |
| `src/dashboard/routes/usage.test.ts` | Tests cover cache TTL, credentials error, API error | VERIFIED | 5/5 tests pass — mocks fs/promises.readFile + globalThis.fetch |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| MessagesPanel.tsx | /api/messages | fetch in useEffect on group/page/search change | WIRED | fetch('/api/messages?...') present |
| MessagesPanel.tsx | /api/groups | fetch on mount | WIRED | fetch('/api/groups') present |
| messages.ts | getMessagesByGroup | DB call in GET handler | WIRED | imported and called |
| server.ts | messagesRouter | app.use('/api', messagesRouter()) | WIRED | mounted in server.ts |
| MemoryPanel.tsx | /api/memory/:group | GET on group select; PUT on save | WIRED | loadGroupContent GET + handleSave PUT |
| memory.ts | fs.readFileSync/writeFileSync via resolveMemoryPath | path traversal guard + fs ops | WIRED | resolveMemoryPath; read/write |
| server.ts | memoryRouter | app.use('/api', memoryRouter()) | WIRED | mounted in server.ts |
| TasksPanel.tsx | /api/tasks | fetch on mount | WIRED | fetch('/api/tasks') present |
| TasksPanel.tsx | /api/tasks/:id/runs | fetch when row expanded | WIRED | fetch('/api/tasks/${taskId}/runs') present |
| tasks.ts | getAllTasks + getTaskRunLogs | DB calls in route handlers | WIRED | imported and called |
| server.ts | tasksRouter | app.use('/api', tasksRouter()) | WIRED | mounted in server.ts |
| TodosPanel.tsx | /api/todos | fetch on mount | WIRED | fetch('/api/todos') present |
| todos.ts | listTodos + listProjects | calls in route handler | WIRED | imported and called |
| server.ts | todosRouter | app.use('/api', todosRouter()) | WIRED | mounted in server.ts |
| UsagePanel.tsx | /api/usage | fetch on mount + Refresh button | WIRED | fetch('/api/usage') present |
| usage.ts | Anthropic OAuth API | fetch with Bearer token from credentials | WIRED | fetchUsage() reads credentials + calls API |
| server.ts | usageRouter | app.use('/api', usageRouter()) | WIRED | mounted in server.ts |
| App.tsx | memoryIsDirtyRef | imported from MemoryPanel, checked in handleNavClick | WIRED | imported; checked before setActive |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| MSG-01 | 03-01 | User can browse message history per group, paginated (50 messages per page) | SATISFIED | MessagesPanel + getMessagesByGroup + /api/messages all verified |
| MSG-02 | 03-01 | User can search message history by text content within a group | SATISFIED | search param forwarded; LIKE query in DB; debounced search input |
| MEM-01 | 03-02 | User can view and edit global groups/global/CLAUDE.md from the dashboard | SATISFIED | GET /api/memory/global returns content; PUT writes to disk |
| MEM-02 | 03-02 | User can view and edit per-group groups/{name}/CLAUDE.md files | SATISFIED | resolveMemoryPath validates against registered group folders |
| MEM-03 | 03-02 | User is warned if they attempt to navigate away with unsaved changes | SATISFIED | beforeunload handler + window.confirm on group change + handleNavClick guard in App.tsx |
| TASK-01 | 03-03 | User can view all scheduled tasks with schedule, last run, next run, and status | SATISFIED | TasksPanel table with all required columns |
| TASK-02 | 03-03 | User can view task run history (last 20 runs per task) including output and errors | SATISFIED | RunLogsRow lazy-fetches /api/tasks/:id/runs; getTaskRunLogs caps at Math.min(limit, 20) |
| TODO-01 | 03-04 | User can view all todo items grouped by project across all groups | SATISFIED | TodosPanel collapsible project sections with full item list |
| TODO-02 | 03-04 | Todo board shows item status, due dates, and assignee | SATISFIED | Each item row shows status badge, due_date, assignee badge |
| USAGE-01 | 03-05 | User can view Claude Code Pro plan usage on demand | SATISFIED | UsagePanel shows five_hour, seven_day, extra_usage with utilization bars; graceful error display |
| USAGE-02 | 03-05 | Usage data is cached for 60 seconds to avoid hammering the CLI | SATISFIED | 60s cache verified in implementation; cache-hit test passes (fetch called once for two requests) |

All 11 requirements satisfied. No orphaned requirements.

---

## Anti-Patterns Found

None. The `vi.mock('child_process')` blocker from the initial verification has been resolved.

---

## Human Verification Required

### 1. Live dashboard — all 5 panels accessible and functional

**Test:** Open http://localhost:3030, click each of Messages, Memory, Tasks, Todos, Usage in the sidebar.
**Expected:**
- Messages: group list appears in left sub-nav; clicking a group loads chat bubbles; search filters messages; Prev/Next pages work.
- Memory: CLAUDE.md content loads for global; editing and saving writes to disk; clicking another nav item with unsaved changes shows confirm dialog.
- Tasks: table renders; clicking a row expands run history inline.
- Todos: project sections appear; Tristan/Deltron filter buttons toggle; subtasks appear indented.
- Usage: quota information or a clear error message is shown (not a crash); Refresh button re-fetches.
- No "Panel coming soon" text remains for any nav item.
**Why human:** Visual layout, real data rendering, and confirm dialog behaviour cannot be verified programmatically.

---

## Gaps Summary

No gaps. All 11 automated must-haves are verified. The single gap from the initial verification — usage.test.ts mocking the wrong module — has been closed. The test file now correctly mocks `fs/promises.readFile` and `globalThis.fetch`, matching the Anthropic OAuth API implementation. All 5 usage tests pass. Full test suite for Phase 3 routes: 23 tests, all green. Both TypeScript compilations clean.

Remaining item is a human-only check: visual confirmation that the live dashboard renders all 5 panels correctly with real data.

---

_Verified: 2026-03-16T20:42:00Z_
_Verifier: Claude (gsd-verifier)_
