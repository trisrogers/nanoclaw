# Feature Research

**Domain:** Operator monitoring and control dashboard for a self-hosted AI assistant platform
**Researched:** 2026-03-15
**Confidence:** HIGH (requirements defined in PROJECT.md, verified against operator dashboard patterns)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist or the dashboard is broken/useless. Users don't credit you for having these; they penalise missing them.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Chat interface with real-time response | The primary reason anyone opens the dashboard. A monitoring panel without direct access to the agent is just a log viewer. | MEDIUM | WebSocket only for this panel. Own isolated session (`dashboard` group folder in DB). Existing orchestrator handles the actual agent execution — dashboard just injects/receives messages. |
| Message history browser | Operators expect to see what was said and when across all groups. Debugging and context recovery. | LOW | SELECT from `messages` table filtered by `chat_jid`. REST endpoint, paginated. No streaming needed. |
| Container/agent status per group | If you can't tell whether the agent is running, the dashboard is blind. "Is it doing something?" is the first question any operator asks. | LOW | In-memory state from `group-queue.ts` already tracks active/idle/stopped. Expose via REST. Poll every 5–10s. |
| Scheduled task list | If tasks exist they must be visible, editable, and triggerable. Operators will break things if they can't see what's scheduled. | MEDIUM | Read from `scheduled_tasks` table. CRUD via REST mapped to existing `db.ts` functions. |
| Group/channel registry view | Which groups/channels are registered, their JID, and whether the underlying channel is connected. | LOW | `getAllRegisteredGroups()` + channel `isConnected()` checks. Read-only in v1 is fine. |
| Log/activity viewer | Every production tool operator expects to tail logs without SSH. Blind failure debugging is unacceptable UX. | MEDIUM | Parse Pino JSON from `logs/` directory. Expose as REST with filter/search. Poll at 5s intervals. |
| Quick actions (clear session, restart container) | Operators need a break-glass mechanism that doesn't require a terminal. | LOW | Map to existing `sessions` table delete + container stop. Two endpoints. |
| Todo / task board view | If the system manages todos, the dashboard must surface them. Hidden state creates distrust. | LOW | Read from `todo_items` + `todo_projects` via `todo.ts` functions. Table/kanban view. |
| Status overview / health summary | A landing page that immediately communicates "everything is fine" or "something is wrong" before drilling in. | LOW | Aggregate: channels connected, containers active, tasks due, any recent errors in logs. Single REST endpoint. |
| Last-updated timestamps everywhere | Users need to know if what they're seeing is current. Stale dashboards are actively misleading. | LOW | Include `fetchedAt` in all REST responses. Display relative time ("3s ago"). |

---

### Differentiators (NanoClaw-Specific Value)

Features that make this dashboard especially useful for the specific way NanoClaw works. These are not generic admin panel patterns — they address real operational needs of this codebase.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| CLAUDE.md editor (per-group + global) | NanoClaw's entire persona and memory is in these files. Editing them from a terminal is tedious; editing from the dashboard is the natural operator workflow. Other AI dashboards don't expose this. | LOW | File read/write via `fs`. Editor with syntax highlighting (CodeMirror or similar). Warn on unsaved changes. |
| Claude Code Pro usage display | Operators running on a metered plan need to know session token usage and weekly reset. No other self-hosted assistant dashboard has this because none use Claude Code. | MEDIUM | Parse `claude /usage` CLI output on-demand (exec'd in container or host). Cache result for 60s. Display usage bar and reset countdown. |
| Per-group isolation status | NanoClaw has strong per-group isolation (sessions, IPC, mounts). The dashboard can visualise this — showing which groups are isolated from each other, what's mounted, what session is active. | MEDIUM | Read `data/sessions/` dirs + DB sessions table. Group detail panel. Useful for debugging cross-contamination. |
| IPC activity feed | NanoClaw's IPC system (agents dropping JSON files, host picking them up) is invisible in normal operation. Surfacing recent IPC events (messages sent, tasks created, todos updated) gives operators a live trace of agent behaviour. | MEDIUM | Watch `data/ipc/` via filesystem events or poll + maintain ring buffer of recent events. Richer than a raw log. |
| Container concurrency visualisation | `group-queue.ts` manages a MAX 5 concurrent container limit with backpressure. When all 5 slots are full, messages queue. Operators need to see this pressure before it causes delays. | LOW | Read from in-memory `GroupQueue` state. Show 5 slots as a visual bar. Colour: green (idle), yellow (active), red (full). |
| Scheduler next-run preview | NanoClaw's scheduler uses drift-free anchor logic for cron/interval tasks. A timeline view of what's due next (next 24h) is uniquely useful — operators tune schedules without guessing. | LOW | Compute next runs for all tasks from schedule_value. Sort. Render as timeline or sorted list. |
| Bot pool status (Telegram) | The optional `TELEGRAM_BOT_POOL` feature assigns pool bots to agent team members. Operators need to see assignments without reading logs. | LOW | Expose in-memory pool assignment map via REST. Read-only. Only show if TELEGRAM_BOT_POOL is configured. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that look good in a requirements list but create meaningful problems in practice.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time log streaming via WebSocket | "Tail -f in the browser" is appealing and feels more alive | Adds a second persistent WebSocket connection (alongside chat). Log volume from Pino can be high. Managing log tailing with reconnects, backpressure, and line buffering is significantly more complex than it appears. PROJECT.md correctly called this out of scope. | 5-second polling of last N log lines from REST. Add a filter/search bar. Operators only need the last 100 lines; they don't need sub-second delivery. |
| .env credential editor | "Edit all config from one place" is natural | Credentials are at rest in `.env`. Exposing them over HTTP (even LAN-only) violates least-privilege. A dashboard compromise directly leaks API tokens. PROJECT.md correctly excluded this. | Document the `.env` path in the dashboard footer. Link to a "restart service" action so the operator workflow is: edit .env manually → click restart. |
| Authentication / login flow | "Secure the dashboard" sounds responsible | This is a single-user LAN tool. Auth adds friction (session management, token refresh, logout handling) with no real security gain. The LAN perimeter is the security boundary. PROJECT.md correctly excluded this. | Bind to `0.0.0.0` with a configurable port. Let the user firewall the port if needed. Add a prominent "no-auth, LAN-only" notice in the UI. |
| Telegram message sending from dashboard | "Send messages to any channel from one place" | The dashboard has its own session. Telegram remains Telegram. Merging them creates confusion about which context is active, and breaks the clean isolation model. | Dashboard chat is the native interface. If Telegram is needed, open Telegram. |
| Live streaming agent stdout | "Watch the agent think in real-time" is compelling | Container stdout already has markers (`---NANOCLAW_OUTPUT_START---`). Streaming arbitrary stdout over WebSocket adds significant complexity and can expose internal tool calls / intermediate reasoning that is not meant for the operator view. | Show the final agent output in the chat panel (already done via chat WebSocket). Show status indicator: "agent running..." with elapsed time. |
| File upload to agents | "Send files to the agent from the dashboard" | The agent filesystem isolation model (per-group mounts with an allowlist) would need to be extended. File handling, storage, and cleanup add scope far beyond v1. | Out of scope for v1. If needed in future, implement via a dedicated `dashboard` group folder upload endpoint that drops files into the correct group dir. |
| Multi-group chat switcher | "Switch between conversations without opening Telegram" | The dashboard session is intentionally isolated. Multiplexing multiple group sessions through the dashboard UI requires session management complexity and defeats the isolation model. | Dashboard has one session. Use Telegram for group-specific conversations. |

---

## Feature Dependencies

```
[Status Overview]
    └──requires──> [Container Status per Group]
    └──requires──> [Group/Channel Registry]
    └──requires──> [Log Reader] (for error count)

[Chat Interface]
    └──requires──> [WebSocket Server] (backend)
    └──requires──> [Dashboard group registered in DB]
    └──enhances──> [IPC Activity Feed] (chat generates IPC events)

[Scheduled Task CRUD]
    └──requires──> [Scheduled Task List] (read before write)
    └──enhances──> [Scheduler Next-Run Preview]

[CLAUDE.md Editor]
    └──requires──> [Group/Channel Registry] (to enumerate group folders)

[Quick Actions]
    └──requires──> [Container Status per Group] (to know what to act on)
    └──requires──> [Session table access]

[Claude Usage Display]
    └──requires──> [Backend exec capability] (run `claude /usage`)
    -- independent of all other features --

[Todo Board]
    -- independent: reads todo_items / todo_projects tables directly --

[IPC Activity Feed]
    └──requires──> [Filesystem polling or watch on data/ipc/]
    └──enhances──> [Container Status per Group] (IPC events explain state changes)

[Bot Pool Status]
    └──requires──> [Group/Channel Registry] (to know Telegram is active)
    └──enhances──> [Status Overview]
```

### Dependency Notes

- **Chat Interface requires WebSocket server:** WebSocket is the only feature that needs a persistent connection. Everything else uses polling REST. Implement WebSocket server first; it unblocks the most important user-facing feature.
- **Status Overview requires multiple data sources:** It is an aggregation panel, not a data source itself. Build it last in the initial phase — it assembles signals from container status, channel registry, and logs.
- **CLAUDE.md Editor requires Group Registry:** The editor needs to know which group folders exist before it can enumerate files. The group registry endpoint is a natural prerequisite.
- **Scheduled Task CRUD requires read-before-write:** Avoid a write-only action form. The task list is the prerequisite view.

---

## MVP Definition

### Launch With (v1)

Minimum to make the dashboard genuinely useful on day one.

- [ ] **Chat interface** (WebSocket, own session) — the primary reason the dashboard exists
- [ ] **Status overview panel** — health at a glance: channels, containers, last error
- [ ] **Container status per group** — running/idle/stopped, elapsed time, quick actions (clear session, restart)
- [ ] **Group/channel registry** — which groups are registered, channel connected state
- [ ] **Message history browser** — search and paginate messages by group
- [ ] **CLAUDE.md editor** — per-group and global, the most unique NanoClaw operator feature
- [ ] **Log viewer** — last N lines, filter by level, poll every 5s
- [ ] **Scheduled task list** — read-only first; CRUD can follow
- [ ] **Todo board** — read-only view of task items and projects

### Add After Validation (v1.x)

Once the core is working and the operator is using it daily.

- [ ] **Scheduled task CRUD** — create, pause, resume, delete tasks from dashboard (trigger: operators hitting the task list and wanting to edit)
- [ ] **Claude usage display** — session token usage and weekly reset (trigger: billing concerns)
- [ ] **IPC activity feed** — live trace of recent agent IPC events (trigger: debugging need)
- [ ] **Scheduler next-run timeline** — 24h preview of what's due (trigger: scheduler becoming heavily used)
- [ ] **Group config editor** — name, trigger settings, requiresTrigger flag (trigger: ops overhead from terminal editing)

### Future Consideration (v2+)

Useful but not blocking.

- [ ] **Container concurrency visualisation** — 5-slot queue bar (trigger: hitting the 5-container limit regularly)
- [ ] **Bot pool status** — Telegram pool bot assignments (trigger: agent teams in active use)
- [ ] **Per-group isolation detail panel** — session IDs, mount list, IPC namespace contents (trigger: debugging cross-group contamination)

---

## Feature Prioritisation Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Chat interface | HIGH | MEDIUM | P1 |
| Status overview | HIGH | LOW | P1 |
| Container status + quick actions | HIGH | LOW | P1 |
| CLAUDE.md editor | HIGH | LOW | P1 |
| Message history browser | HIGH | LOW | P1 |
| Log viewer | HIGH | MEDIUM | P1 |
| Group/channel registry | MEDIUM | LOW | P1 |
| Todo board (read-only) | MEDIUM | LOW | P1 |
| Scheduled task list (read-only) | MEDIUM | LOW | P1 |
| Scheduled task CRUD | MEDIUM | MEDIUM | P2 |
| Claude usage display | MEDIUM | MEDIUM | P2 |
| IPC activity feed | MEDIUM | MEDIUM | P2 |
| Scheduler next-run timeline | LOW | LOW | P2 |
| Group config editor | LOW | MEDIUM | P2 |
| Container concurrency visualisation | LOW | LOW | P3 |
| Bot pool status | LOW | LOW | P3 |
| Per-group isolation detail | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## UX Patterns and Refresh Strategies

### Update Strategies by Panel

| Panel | Strategy | Interval | Rationale |
|-------|----------|----------|-----------|
| Chat | WebSocket (bidirectional) | Push | Chat is the only feature needing sub-second delivery. Typing indicators, streaming responses. Worth the connection overhead. |
| Container status | REST poll | 5s | State changes a few times per minute at most. 5s lag is imperceptible to operators. |
| Log viewer | REST poll | 5s | Operators aren't watching logs tick by the second. 5s is responsive without hammering the filesystem. |
| IPC activity feed | REST poll | 3s | IPC events are brief bursts; 3s is enough to feel live. |
| Status overview | REST poll | 10s | Aggregate health. 10s is fine for a summary panel. |
| Message history | On demand (user-triggered) | None | Historical data. Only fetch when user navigates to it. |
| Todo board | On demand + manual refresh | None | Task data changes only when the agent or user explicitly acts. |
| Scheduled tasks | On demand + manual refresh | None | Schedule data changes rarely. |
| Claude usage | On demand (button-triggered) | 60s cache | Running `claude /usage` has non-trivial overhead. Cache 60s. |
| CLAUDE.md editor | On demand | None | File content. Load once on open; warn on conflict if another session edited it. |

### Layout Patterns

- **Sidebar navigation** (not top tabs): Dashboards with many panels need persistent navigation. Sidebar allows nesting (e.g. Groups → per-group detail). Standard pattern for operator tools (Grafana, Retool, Portainer).
- **Status cards above the fold**: The overview page should have 3–4 KPI cards immediately visible: Channels Connected, Containers Active, Tasks Pending, Last Error. Operators make a go/no-go read in 2 seconds.
- **Panel-level "last updated" timestamps**: Every data panel shows when data was fetched. Prevents operators from acting on stale state.
- **Destructive actions require confirmation**: Clear session, restart container — show a confirmation modal. These actions interrupt active agent work.
- **Active container spinner**: When a container is running, show an animated indicator and elapsed time. Static "running" text is insufficient — operators need to know if it's been running 3s or 3 minutes.

---

## Competitor Feature Analysis

| Feature | Zendesk AI Agents Dashboard | Microsoft Agent 365 | OpenWebUI (self-hosted) | NanoClaw Dashboard Approach |
|---------|---------------------------|---------------------|--------------------------|-----------------------------|
| Chat with agent | Yes | Yes | Yes (primary feature) | Yes, isolated session |
| Container/process health | No (SaaS) | No (SaaS) | No | Yes (NanoClaw-specific) |
| Message history | Yes (conversation logs) | Yes (audit trail) | Yes | Yes |
| Scheduled tasks | No | Limited | No | Yes |
| Memory file editing | No | No | Custom instructions only | Yes (CLAUDE.md full editor) |
| Token/usage tracking | Yes (via billing) | Yes | No (local models) | Yes (claude /usage) |
| Log viewer | No (external tools) | Yes (audit logs) | No | Yes |
| Quick actions | No | Limited | Restart chat only | Yes (clear session, restart container) |

SaaS platforms handle infrastructure so they never expose container health. Self-hosted tools like OpenWebUI focus on the chat experience and lack operational panels. The NanoClaw dashboard is the only tool in this space that combines chat + container operations + scheduler + memory file editing in a single panel, because it's purpose-built for this specific runtime.

---

## Sources

- [AI Agent Monitoring: Best Practices, Tools, and Metrics for 2026 - UptimeRobot](https://uptimerobot.com/knowledge-hub/monitoring/ai-agent-monitoring-best-practices-tools-and-metrics/)
- [Using the dashboard to monitor and manage advanced AI agents - Zendesk](https://support.zendesk.com/hc/en-us/articles/9748041653658-Using-the-dashboard-to-monitor-and-manage-advanced-AI-agents)
- [Microsoft Agent 365: The Control Plane for Agents](https://www.microsoft.com/en-us/microsoft-agent-365)
- [Admin Dashboard UI/UX: Best Practices for 2025 - Medium](https://medium.com/@CarlosSmith24/admin-dashboard-ui-ux-best-practices-for-2025-8bdc6090c57d)
- [From Data To Decisions: UX Strategies For Real-Time Dashboards - Smashing Magazine](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [Don't Forget the User: Polling vs WebSockets in 2025 - Medium](https://medium.com/israeli-tech-radar/dont-forget-the-user-polling-vs-websockets-in-2025-cb99999db9be)
- [AI Agent Observability - Evolving Standards and Best Practices - OpenTelemetry](https://opentelemetry.io/blog/2025/ai-agent-observability/)
- [Agent Factory: Top 5 agent observability best practices - Microsoft Azure](https://azure.microsoft.com/en-us/blog/agent-factory-top-5-agent-observability-best-practices-for-reliable-ai/)
- [Dashboard Design Patterns - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [NanoClaw PROJECT.md](.planning/PROJECT.md) — primary requirements source
- [NanoClaw CODEBASE.md](docs/CODEBASE.md) — data sources, runtime state available for each panel

---
*Feature research for: NanoClaw operator dashboard*
*Researched: 2026-03-15*
