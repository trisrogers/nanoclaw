# Phase 3: Data Panels - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the five data and configuration panels: message history browser, CLAUDE.md editor, scheduled tasks viewer, todos board, and Claude usage panel. All five slot into existing sidebar nav placeholders in `App.tsx`. Phase 3 is read-heavy with one edit capability (CLAUDE.md). No Kanban, no task management — those are v2.

</domain>

<decisions>
## Implementation Decisions

### Message History Panel
- **Layout**: Chat bubble style — user messages right-aligned, Deltron/bot messages left-aligned. Matches the Chat panel aesthetic already established.
- **Group selector**: Left sub-nav sidebar within the Messages panel, listing all registered groups. Selected group loads its history on the right.
- **Fields per message**: timestamp, sender_name, content, is_bot_message visual indicator (badge or bubble color)
- **Pagination**: 50 messages per page (per MSG-01)
- **Search**: Server-side LIKE query via `/api/messages?group=...&search=...` endpoint. Searches entire history across all pages — not just the current page.

### CLAUDE.md Editor Panel
- No specific UX decisions captured — Claude's discretion for the file selector (global vs per-group) and layout
- **Required behavior**: Warn user before navigating away with unsaved changes (MEM-03)
- Path traversal guard required (only allow `groups/*/CLAUDE.md` paths)

### Todos Board Panel
- **Layout**: Stacked sections — one collapsible section per project (TSK, PFR, etc.) with item count badge. Items listed within each section.
- **Subtasks**: Show indented beneath their parent item
- **Default filter**: Open items only. Toggle to show all (open + done + cancelled)
- **Assignee**: Badge on each item showing tristan/deltron. Plus two filter buttons (one per assignee) as preset filters — clicking "Tristan" or "Deltron" filters to that assignee's items only. Clicking again clears filter.

### Scheduled Tasks Panel
- **Layout**: Table with expandable rows. Each task row shows: group name, prompt (full text, wrapped), schedule, last run, next run, status. Click a row to expand and see the last 20 run logs inline.
- **Run log columns**: run_at, duration_ms, status, result/error truncated to ~100 chars (full text on hover or expand)

### Claude Usage Panel
- No specific UX decisions captured — Claude's discretion for layout
- **Required behavior**: Cache output for 60 seconds (USAGE-02); display gracefully if CLI output can't be parsed (STATE.md notes this format is undocumented)

### Claude's Discretion
- CLAUDE.md editor file selector UX (dropdown, tab strip, or sidebar — choose what fits cleanest)
- Claude usage panel layout and error/fallback display
- Empty states for all panels (no messages, no tasks, no todos)
- Exact spacing, typography, icon choices (lucide-react available)
- Error states within panels

</decisions>

<specifics>
## Specific Ideas

- Message history bubbles should match the Chat panel visual style for consistency
- Todos assignee filter: two toggle buttons ("Tristan" / "Deltron") — small, above the project sections — preset filters, not a dropdown
- Task run history: result/error text truncated inline with a way to see the full text (hover tooltip or an expand affordance)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dashboard/src/components/ChatPanel.tsx`: Chat bubble style already implemented — message history panel can reference or share its bubble CSS classes
- `lucide-react`: Available for icons (chevrons for expand/collapse, filter icons, assignee avatars)
- Dark theme palette: `bg-gray-950/900/800`, `text-gray-100/400` — all new components follow this

### Established Patterns
- Route factory pattern: `src/dashboard/routes/stats.ts` — each route is a function returning `Router`, taking `DashboardDeps` if needed
- `logsRouter` reads filesystem directly (no DashboardDeps) — message/task/todo routes will read DB directly via `getDb()` or existing db.ts exports
- Client-side filtering pattern established in LogsPanel (level filter). Message search is server-side by contrast (SQL LIKE across all pages)
- `src/db.ts`: `getAllTasks()`, `logTaskRun()`, `listTodos()`, `listProjects()` — all available for route handlers. Need new `getMessagesByGroup(jid, page, search)` and `getTaskRunLogs(taskId)` queries.
- `task_run_logs` table schema: `(id, task_id, run_at, duration_ms, status, result, error)` — queryable by task_id

### Integration Points
- **App.tsx**: Replace `{active === 'Messages' && <placeholder>}` etc. with real panel components — same pattern as Phase 2 panels
- **Messages route**: New `/api/messages?group=<jid>&page=<n>&search=<q>` endpoint reading from `messages` table. Needs new db.ts query function.
- **Memory route**: New `/api/memory/:group` GET + PUT endpoints reading/writing `groups/:group/CLAUDE.md` filesystem files. Path validation: only allow known group names.
- **Tasks route**: New `/api/tasks` (list) and `/api/tasks/:id/runs` (last 20 run logs) endpoints using `getAllTasks()` + new `getTaskRunLogs(taskId)` DB query.
- **Todos route**: New `/api/todos` endpoint using `listTodos()` + `listProjects()` from `src/todo.ts`
- **Usage route**: New `/api/usage` endpoint that spawns `claude /usage`, parses output, caches for 60s

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-data-panels*
*Context gathered: 2026-03-16*
