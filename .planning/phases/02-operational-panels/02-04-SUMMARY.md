---
phase: 02-operational-panels
plan: "04"
subsystem: ui
tags: [websocket, react, channel, chat, deltron, agent-pipeline]

# Dependency graph
requires:
  - phase: 02-01
    provides: DashboardDeps interface + startDashboardServer + WebSocketServer stub on /ws/chat

provides:
  - WebDashboardChannel class implementing Channel interface (ownsJid 'web:dashboard')
  - createChatHandler wiring WS messages to storeMessage + enqueueMessageCheck
  - web:dashboard group registered in-memory in main() (NOT in DB)
  - ChatPanel React component with messenger bubble UI and typing indicator
  - /ws/chat WebSocket fully wired to agent pipeline

affects:
  - 02-05
  - 03-*

# Tech tracking
tech-stack:
  added: []
  patterns:
    - In-memory channel + group registration (no setRegisteredGroup call) for virtual channels
    - DashboardDeps carries storeMessage + enqueueMessageCheck to break circular import
    - createChatHandler factory pattern — deps injected, returns connection handler

key-files:
  created:
    - src/channels/web-dashboard.ts
    - src/dashboard/chat-handler.ts
    - src/dashboard/chat-handler.test.ts
    - dashboard/src/components/ChatPanel.tsx
  modified:
    - src/dashboard/types.ts
    - src/dashboard/server.ts
    - src/index.ts
    - dashboard/src/App.tsx
    - src/dashboard/server.test.ts
    - src/dashboard/routes/channels.test.ts
    - src/dashboard/routes/stats.test.ts
    - src/dashboard/routes/containers.test.ts
    - docs/CODEBASE.md

key-decisions:
  - "web:dashboard registered in-memory only — calling setRegisteredGroup() would persist to DB and pollute the Groups panel"
  - "DashboardDeps carries storeMessage + enqueueMessageCheck as function references — avoids circular import from chat-handler.ts back to index.ts"
  - "WebDashboardChannel created at module scope in index.ts (not via factory/registry) — it has no credentials or startup handshake"
  - "ChatPanel manages full-height flex layout via conditional class in App.tsx — Chat panel needs overflow:hidden, not overflow:auto"

patterns-established:
  - "Virtual channel pattern: create Channel instance at module scope, push to channels[] in-memory, set registeredGroups[jid] in-memory — never call setRegisteredGroup()"
  - "WebSocket frame protocol: { type: 'message', text } for responses, { type: 'typing', value } for indicators"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04]

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 02 Plan 04: Dashboard Chat Integration Summary

**WebSocket chat channel (web:dashboard) wired to agent pipeline with messenger bubble UI — users can chat with Deltron directly from the browser, isolated from Telegram**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-15T21:55:25Z
- **Completed:** 2026-03-16T22:15:00Z
- **Tasks:** 3 of 3 (all complete including end-to-end verification)
- **Files modified:** 13

## Accomplishments
- WebDashboardChannel implements Channel interface, manages browser WS client Set, broadcasts message/typing frames
- createChatHandler wires WS messages through storeMessage + enqueueMessageCheck into the existing orchestrator pipeline
- web:dashboard registered in-memory (not DB) — fully invisible to Groups panel and other channels
- ChatPanel renders messenger-style bubbles with three-dot animated typing indicator, Enter-to-send, Shift+Enter for newline, auto-scroll
- All 394 tests pass, TypeScript clean, dashboard builds without errors
- End-to-end verified: message sent, typing indicator appeared, Deltron responded, no Telegram contamination, web:dashboard confirmed absent from DB

## Task Commits

Each task was committed atomically:

1. **Task 1: RED stub** - `d394ea3` (test)
2. **Task 1: GREEN implementation** - `058a82c` (feat)
3. **Task 2: Wire server + ChatPanel** - `21dab74` (feat)
4. **Fix: Replace crypto.randomUUID with HTTP-safe fallback** - `37272b9` (fix)

**Task 3** (end-to-end verification) confirmed by user after the two bugs above were fixed.

_Note: TDD tasks have separate RED + GREEN commits_

## Files Created/Modified
- `src/channels/web-dashboard.ts` - WebDashboardChannel: ownsJid('web:dashboard'), sendMessage/setTyping broadcast to WS clients
- `src/dashboard/chat-handler.ts` - createChatHandler: WS message → storeMessage + enqueueMessageCheck
- `src/dashboard/chat-handler.test.ts` - 6 tests covering the handler contract
- `dashboard/src/components/ChatPanel.tsx` - Messenger-style bubble chat UI with typing indicator
- `src/dashboard/types.ts` - Extended DashboardDeps with webDashboardChannel, storeMessage, enqueueMessageCheck
- `src/dashboard/server.ts` - Wired createChatHandler into wss.on('connection')
- `src/index.ts` - Added WebDashboardChannel instance, channels.push + registeredGroups registration before recoverPendingMessages
- `dashboard/src/App.tsx` - Added ChatPanel import + conditional render; Chat panel uses overflow:hidden flex layout
- `docs/CODEBASE.md` - Updated to reflect new channel, handler, and UI component

## Decisions Made
- web:dashboard registered in-memory only — calling `setRegisteredGroup()` would persist to DB and the group would appear in the Groups panel after restart
- `DashboardDeps` carries `storeMessage` and `enqueueMessageCheck` as function references — avoids a circular import from `chat-handler.ts` back to `index.ts`
- `WebDashboardChannel` created at module scope in `index.ts` (not via factory/registry) — it has no credentials or startup handshake, so it doesn't fit the self-registration model

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated all test mockDeps to satisfy new DashboardDeps shape**
- **Found during:** Task 1 (typecheck after extending DashboardDeps)
- **Issue:** Four existing test files had mockDeps missing the new required fields (webDashboardChannel, storeMessage, enqueueMessageCheck, and also getRegisteredGroups/clearGroupSession/restartGroupContainer added in 02-02 that weren't in some mocks)
- **Fix:** Added stub values for all new required fields across server.test.ts, channels.test.ts, stats.test.ts, containers.test.ts
- **Files modified:** src/dashboard/server.test.ts, src/dashboard/routes/channels.test.ts, src/dashboard/routes/stats.test.ts, src/dashboard/routes/containers.test.ts
- **Verification:** npm run typecheck passes clean; npm test 394/394 pass
- **Committed in:** 058a82c (Task 1 GREEN commit)

**2. [Rule 2 - Missing Critical] Chat panel layout needs overflow:hidden not overflow:auto**
- **Found during:** Task 2 (ChatPanel UI design)
- **Issue:** App.tsx used `overflow-auto p-6` on main — Chat panel requires flex column with internal scroll, not outer scroll
- **Fix:** Added conditional class to `<main>` in App.tsx: Chat uses `overflow-hidden flex flex-col`, all other panels use `overflow-auto p-6`
- **Files modified:** dashboard/src/App.tsx
- **Verification:** Dashboard build passes
- **Committed in:** 21dab74 (Task 2 commit)

**3. [Rule 1 - Bug] crypto.randomUUID() unavailable on non-secure HTTP origin**
- **Found during:** Task 3 verification (end-to-end chat test)
- **Issue:** Chrome throws `TypeError: crypto.randomUUID is not a function` when the page is served over HTTP. ChatPanel used `crypto.randomUUID()` for message IDs; the dashboard runs on plain HTTP at localhost:3030.
- **Fix:** Replaced with `genId()` helper: `Math.random().toString(36).slice(2) + Date.now().toString(36)`. Applied in both the React component and the server-side chat handler.
- **Files modified:** `dashboard/src/components/ChatPanel.tsx`, `src/dashboard/chat-handler.ts`
- **Verification:** Chat panel loaded without errors, messages received IDs correctly
- **Committed in:** `37272b9`

**4. [Rule 3 - Blocking] TypeScript dist/ not compiled — all /api/* routes returning HTML**
- **Found during:** Task 3 verification (end-to-end chat test)
- **Issue:** `SyntaxError: Unexpected token '<'` in browser console for all API fetch calls. The TypeScript source had not been compiled to `dist/`. The SPA catch-all in Express served `index.html` for all `/api/*` requests.
- **Fix:** `npm run build && cd dashboard && npm run build`, then `systemctl --user restart nanoclaw`. `/api/stats` and `/api/channels` confirmed returning JSON.
- **Files modified:** `dist/` (compiled output — not tracked in git)
- **Verification:** `curl http://localhost:3030/api/stats` returned JSON; dashboard loaded correctly
- **Committed in:** Build step only — no source change required

---

**Total deviations:** 4 auto-fixed (2 Rule 2 — missing critical correctness, 1 Rule 1 — bug, 1 Rule 3 — blocking build step)
**Impact on plan:** All fixes necessary for correctness and runtime operation. No scope creep.

## Issues Encountered

- `crypto.randomUUID()` throws on non-secure HTTP origins — established the `genId()` fallback pattern for any future client-side ID generation in the dashboard (HTTP context).
- Uncompiled `dist/` caused all API routes to return HTML — a one-time build step issue resolved by running `npm run build` before service restart.

## Next Phase Readiness

- All four chat requirements (CHAT-01 through CHAT-04) delivered and end-to-end verified
- Phase 2 fully complete: Stats, Channels, Containers, Logs, and Chat panels operational
- Phase 3 (usage panel, Claude metrics) can proceed without blockers
- One open research flag: `claude /usage` output format is undocumented — needs empirical testing before building the parsing endpoint (noted for 03-05)

## Self-Check: PASSED

All created files exist on disk. All task commits (d394ea3, 058a82c, 21dab74, 37272b9) verified in git log. Task 3 end-to-end verification confirmed by user.

---
*Phase: 02-operational-panels*
*Completed: 2026-03-16*
