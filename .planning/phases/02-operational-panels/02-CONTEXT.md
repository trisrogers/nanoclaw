# Phase 2: Operational Panels - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the core operational panels — status overview, groups/channels, container status, log viewer, and dashboard chat — so users can monitor NanoClaw's live state and chat with Deltron from the browser without touching the terminal.

Creating/editing data (messages, todos, tasks, CLAUDE.md) is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Chat panel appearance
- Messenger bubble style: user messages right-aligned (blue), Deltron's left-aligned (dark gray)
- Enter to send; Shift+Enter for newlines in the input box
- Typing indicator: animated three-dot bubble on Deltron's side while processing
- Session history persists in React component state while the SPA is open; clears on page reload (no need to persist across sessions)

### Overview panel layout
- Two-column grid layout for stat cards (not a single horizontal row)
- Stat cards to show: channels connected, active containers, IPC queue depth, todos due today, last error — **five cards total** (pending tasks split into two: IPC queue + todos due)
- "Last error" = most recent Pino log entry at level `error` or above
- Groups/channels table sits below or alongside the stats grid
- Overview auto-refreshes every 10 seconds (per requirements)

### Log viewer behaviour
- Auto-scroll to bottom **only if already at bottom** — if user has scrolled up to investigate, refresh does not jump viewport
- Level filter is **client-side**: backend always returns all 200 lines; frontend filters by selected level (instant toggle, no extra requests)
- Display: monospace font, timestamp + colour-coded level badge (error=red, warn=yellow, info=gray, debug=dim) + message; Pino JSON fields collapsed into the message
- Auto-refreshes every 5 seconds (per requirements)

### Destructive action confirmation (container panel)
- **Inline confirm pattern**: clicking "Clear session" or "Restart" transforms the button into a "Confirm?" + "Cancel" pair in place — no modal
- Container status panel layout: Claude's discretion (table vs cards depending on what's clearest)

### Claude's Discretion
- Container status panel layout (table vs cards) — choose based on what fits the dark Tailwind theme best
- Exact spacing, typography, icon choices (lucide-react is available)
- Error state and empty state handling within panels

</decisions>

<specifics>
## Specific Ideas

- Chat should feel like iMessage/WhatsApp — familiar bubble pattern, not a terminal or log
- The inline confirm button pattern (no modals for destructive actions) keeps the UI fast and keyboard-navigable
- Log level colour scheme: error=red, warn=amber/yellow, info=gray, debug=dim gray — consistent with typical terminal colouring

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dashboard/src/App.tsx`: Sidebar nav already wired with all 10 panel names. Phase 2 panels (Overview, Chat, Containers, Logs, Groups) can slot in by replacing the placeholder `<main>` content with per-panel components
- `lucide-react`: Already installed — use for icons (status indicators, send button, refresh, etc.)
- `tailwindcss` v4: Already installed. Dark theme established: `bg-gray-950` body, `bg-gray-900` sidebar, `border-gray-800` dividers, `text-gray-100/400` text hierarchy

### Established Patterns
- No shared component files yet — `App.tsx` is the only component. Phase 2 will create the component architecture from scratch
- Dark theme palette locked in from Phase 1 — all new components should follow `gray-950/900/800` pattern
- REST route pattern: `src/dashboard/routes/groups.ts` — add new route files here, register in `server.ts` under `app.use('/api', ...)`
- WebSocket server already created on `/ws/chat` in `server.ts` — needs real message handler wired to the orchestrator

### Integration Points
- **Chat**: WebSocket `/ws/chat` skeleton exists in `server.ts`. Needs: message handler that injects into the orchestrator's group queue for `web:dashboard` JID, and outbound push back to the WS client when Deltron responds
- **Groups/channels**: `/api/groups` endpoint already exists in `src/dashboard/routes/groups.ts` — groups panel can consume this directly. Channel connection status needs a new endpoint reading in-memory channel state from `src/index.ts`
- **Container status**: Needs a new `/api/containers` endpoint exposing in-memory session/container state per group (running/idle/stopped + elapsed time). Clear-session and restart-container need POST endpoints that call the existing session teardown logic
- **Logs**: Needs a new `/api/logs` endpoint that reads the Pino log file (last 200 lines) and returns parsed JSON log entries
- **Overview stats**: New `/api/stats` endpoint aggregating: channel count, active container count, IPC queue depth, todos due today (from `src/todo.ts`), last error (from log file)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-operational-panels*
*Context gathered: 2026-03-16*
