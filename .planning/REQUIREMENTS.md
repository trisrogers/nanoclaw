# Requirements: NanoClaw Dashboard

**Defined:** 2026-03-15
**Core Value:** You can see everything NanoClaw is doing and intervene without touching the terminal or opening Telegram.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: Dashboard HTTP server starts with NanoClaw process on a configurable port (default 3030)
- [x] **INFRA-02**: Dashboard serves React SPA static files from `dashboard/dist/` in production
- [x] **INFRA-03**: Dashboard HTTP server is registered in the existing NanoClaw shutdown handler (SIGTERM/SIGINT)
- [x] **INFRA-04**: Dashboard WebSocket server shares the same HTTP server port as REST endpoints
- [x] **INFRA-05**: Dashboard is accessible on LAN (binds to 0.0.0.0 or configurable bind address), no authentication required
- [x] **INFRA-06**: Vite dev server proxies API and WebSocket requests to the backend (development workflow)

### Overview

- [x] **OVER-01**: User can view a status overview panel showing: channels connected, active containers, pending tasks, and last error
- [x] **OVER-02**: Status overview data refreshes automatically every 10 seconds

### Chat

- [x] **CHAT-01**: User can send messages to Deltron from the dashboard using an isolated dashboard session (JID: `web:dashboard`)
- [x] **CHAT-02**: User receives Deltron's responses in real-time via WebSocket
- [x] **CHAT-03**: Dashboard chat session is isolated from Telegram and all other group sessions
- [x] **CHAT-04**: User can see a typing/thinking indicator while Deltron is processing

### Operations

- [x] **OPS-01**: User can view container status per group (running / idle / stopped) with elapsed time for active containers
- [x] **OPS-02**: User can clear a group's session from the dashboard (confirmation required)
- [x] **OPS-03**: User can restart a group's container from the dashboard (confirmation required)
- [x] **OPS-04**: User can view agent activity logs (last 200 lines from Pino JSON log files) with level filtering
- [x] **OPS-05**: Log viewer refreshes automatically every 5 seconds

### Groups & Channels

- [x] **GRP-01**: User can view all registered groups with their JID, folder, isMain status, and requiresTrigger setting
- [x] **GRP-02**: User can view all channels with their connection status (connected / disconnected)

### Message History

- [x] **MSG-01**: User can browse message history per group, paginated (50 messages per page)
- [x] **MSG-02**: User can search message history by text content within a group

### CLAUDE.md Editor

- [x] **MEM-01**: User can view and edit the global `groups/global/CLAUDE.md` file from the dashboard
- [x] **MEM-02**: User can view and edit per-group `groups/{name}/CLAUDE.md` files from the dashboard
- [x] **MEM-03**: User is warned if they attempt to navigate away with unsaved changes

### Scheduled Tasks

- [x] **TASK-01**: User can view all scheduled tasks with their schedule, last run time, next run time, and status
- [x] **TASK-02**: User can view task run history (last 20 runs per task) including output and errors

### Todos

- [x] **TODO-01**: User can view all todo items grouped by project across all groups
- [x] **TODO-02**: Todo board shows item status (pending / done), due dates, and assignee

### Claude Usage

- [x] **USAGE-01**: User can view Claude Code Pro plan usage on demand (session usage, weekly limit, reset time)
- [x] **USAGE-02**: Usage data is cached for 60 seconds to avoid hammering the CLI

---

## v2 Requirements

Deferred to post-launch. Tracked but not in current roadmap.

### Scheduled Task Management

- **TASK-03**: User can create a new scheduled task from the dashboard
- **TASK-04**: User can pause and resume scheduled tasks from the dashboard
- **TASK-05**: User can delete scheduled tasks from the dashboard (confirmation required)
- **TASK-06**: User can manually trigger a scheduled task to run immediately

### IPC Activity Feed

- **IPC-01**: User can view a live feed of recent IPC events (messages sent, tasks created, todos updated) polling every 3 seconds
- **IPC-02**: IPC feed shows event type, group, timestamp, and payload summary

### Scheduler Timeline

- **SCHED-01**: User can view a 24-hour preview of upcoming scheduled task runs sorted by next-run time

### Group Config Editor

- **GRP-03**: User can edit a group's name, trigger settings, and requiresTrigger flag from the dashboard
- **GRP-04**: Changes to group config take effect after NanoClaw service restart (dashboard displays this notice)

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Authentication / login | Single-user LAN tool; LAN perimeter is the security boundary |
| .env / credential editing | Exposes API keys over HTTP; security risk even on LAN |
| Real-time log streaming (WebSocket) | Polling every 5s is sufficient; WebSocket adds complexity without meaningful value |
| Telegram message sending from dashboard | Dashboard has its own session; Telegram remains Telegram |
| File upload to agents | Agent filesystem isolation would need extension; out of scope for v1 |
| Multi-group chat switcher | Dashboard session is intentionally isolated; Telegram handles group conversations |
| Live agent stdout streaming | Final output via chat panel is sufficient; streaming intermediate reasoning adds complexity |
| HTTPS / TLS | LAN-only; user's responsibility to firewall the port |
| Mobile responsive layout | Desktop browser first |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| INFRA-01 | Phase 1 | 01-01 | Pending |
| INFRA-02 | Phase 1 | 01-02 | Pending |
| INFRA-03 | Phase 1 | 01-01 | Pending |
| INFRA-04 | Phase 1 | 01-01 | Pending |
| INFRA-05 | Phase 1 | 01-01 | Pending |
| INFRA-06 | Phase 1 | 01-02 | Pending |
| OVER-01 | Phase 2 | 02-01 | Pending |
| OVER-02 | Phase 2 | 02-01 | Pending |
| CHAT-01 | Phase 2 | 02-04 | Complete |
| CHAT-02 | Phase 2 | 02-04 | Complete |
| CHAT-03 | Phase 2 | 02-04 | Complete |
| CHAT-04 | Phase 2 | 02-04 | Complete |
| OPS-01 | Phase 2 | 02-02 | Pending |
| OPS-02 | Phase 2 | 02-02 | Pending |
| OPS-03 | Phase 2 | 02-02 | Pending |
| OPS-04 | Phase 2 | 02-03 | Pending |
| OPS-05 | Phase 2 | 02-03 | Pending |
| GRP-01 | Phase 2 | 02-01 | Pending |
| GRP-02 | Phase 2 | 02-01 | Pending |
| MSG-01 | Phase 3 | 03-01 | Pending |
| MSG-02 | Phase 3 | 03-01 | Pending |
| MEM-01 | Phase 3 | 03-02 | Pending |
| MEM-02 | Phase 3 | 03-02 | Pending |
| MEM-03 | Phase 3 | 03-02 | Pending |
| TASK-01 | Phase 3 | 03-03 | Pending |
| TASK-02 | Phase 3 | 03-03 | Pending |
| TODO-01 | Phase 3 | 03-04 | Pending |
| TODO-02 | Phase 3 | 03-04 | Pending |
| USAGE-01 | Phase 3 | 03-05 | Pending |
| USAGE-02 | Phase 3 | 03-05 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 — traceability expanded with per-requirement rows and plan assignments after roadmap creation*
