# NanoClaw Codebase Map

This document describes how NanoClaw is structured and how all the pieces connect at runtime.
**Keep this file up to date whenever you change code.** It is the primary reference for making accurate, targeted changes.

---

## Architecture in One Sentence

A single Node.js process receives messages from channels (Telegram, Gmail), stores them in SQLite, routes them to isolated Docker containers running Claude agents, and sends agent responses back out through the originating channel.

---

## Directory Structure

```
nanoclaw/
├── src/                    # All host-side TypeScript source
│   ├── index.ts            # Main orchestrator — ties everything together
│   ├── types.ts            # All shared interfaces and type contracts
│   ├── config.ts           # All env vars / constants in one place
│   ├── db.ts               # All SQLite operations
│   ├── router.ts           # Message formatting and outbound routing
│   ├── container-runner.ts # Spawns Docker containers for agent execution
│   ├── container-runtime.ts# Docker CLI abstraction (runtime detection, mounts)
│   ├── credential-proxy.ts # HTTP proxy that injects credentials into containers
│   ├── dashboard/
│   │   ├── server.ts       # Dashboard HTTP + WebSocket server (startDashboardServer(port, host, deps))
│   │   ├── types.ts        # DashboardDeps + ContainerSnapshot interfaces
│   │   └── routes/
│   │       ├── groups.ts   # GET /api/groups — registered groups from DB (LIMIT 100)
│   │       ├── logs.ts     # GET /api/logs — last 200 parsed pino-pretty log entries
│   │       ├── stats.ts    # GET /api/stats — 5-key live metrics (channels, containers, IPC, todos, error)
│   │       └── channels.ts # GET /api/channels — channel name + connection status array
│   ├── ipc.ts              # Watches IPC dirs for container → host communication
│   ├── task-scheduler.ts   # Runs scheduled tasks (cron / interval / once)
│   ├── todo.ts             # Todo/task CRUD (projects, items, reminders)
│   ├── group-queue.ts      # Concurrency manager (max 5 concurrent containers)
│   ├── group-folder.ts     # Group folder path resolution and validation
│   ├── sender-allowlist.ts # Optional per-sender/per-chat message filtering
│   ├── logger.ts           # Pino logger (pretty print, uncaught exception handler)
│   ├── env.ts              # .env file loader
│   └── channels/
│       ├── index.ts        # Barrel: importing here triggers self-registration
│       ├── registry.ts     # Channel factory registry
│       ├── telegram.ts     # Telegram bot (grammy)
│       ├── gmail.ts        # Gmail polling (Google APIs + OAuth2)
│       ├── discord.ts      # Discord bot (disabled — output goes to Telegram)
│       └── whatsapp.ts     # WhatsApp (not installed)
├── groups/
│   ├── global/CLAUDE.md    # Agent identity/instructions (all agents read this)
│   └── {groupFolder}/      # Per-group working directory (mounted rw into container)
├── data/
│   ├── ipc/{groupFolder}/  # Container ↔ host IPC (JSON files)
│   │   ├── messages/       # Outbound message requests from agents
│   │   └── tasks/          # Task / todo / admin requests from agents
│   ├── sessions/{folder}/  # Per-group .claude/ sessions (isolated)
│   └── env/env             # Container env file (must mirror .env)
├── store/
│   └── messages.db         # SQLite database (all persistent state)
├── container/
│   ├── Dockerfile          # Agent container image
│   ├── build.sh            # Build script
│   ├── agent-runner/       # Claude Agent SDK runner (mounted into containers)
│   └── skills/             # Container-side skill docs (e.g. telegram-buttons)
└── scripts/
    ├── tasks.ts            # CLI for task management (npx tsx scripts/tasks.ts)
    └── whisper_transcribe.py # Local voice transcription (faster-whisper)
```

---

## Runtime Data Flow

### Inbound Message (Channel → Agent)

```
Channel event (Telegram message / Gmail poll)
  │
  ▼
onMessage(jid, message) callback  [channels/telegram.ts or gmail.ts]
  │  Stores message in DB
  ▼
storeMessage() + storeChatMetadata()  [db.ts]
  │
  ▼
startMessageLoop()  [index.ts] — polls getNewMessages() every POLL_INTERVAL (2s)
  │  Checks trigger pattern (@Deltron or isMain group)
  │  Deduplicates by JID; skips already-running groups
  ▼
queue.enqueueMessageCheck(groupFolder)  [group-queue.ts]
  │  Respects MAX_CONCURRENT_CONTAINERS (5)
  │  Exponential backoff on failure (max 5 retries)
  ▼
processGroupMessages(group)  [index.ts]
  │  Fetches message history from DB
  │  Formats as XML via formatMessages()  [router.ts]
  ▼
runAgent(group, prompt)  [index.ts]
  │  Writes tasks/groups/todos snapshots for container
  ▼
runContainerAgent(groupFolder, prompt, onOutput)  [container-runner.ts]
  │  Builds volume mounts (validated against allowlist)
  │  Builds docker run args (--add-host, --env-file, --network)
  │  Injects CLAUDE_CODE_CREDENTIALS_URL → http://host.docker.internal:3001
  │  Spawns docker process
  │  Streams stdout looking for markers:
  │    ---NANOCLAW_OUTPUT_START--- ... ---NANOCLAW_OUTPUT_END---
  ▼
onOutput(text) callback  [index.ts]
  │  Strips <internal> tags via formatOutbound()  [router.ts]
  ▼
channel.sendMessage(jid, text)  [channels/telegram.ts]
  │  Splits messages > 4096 chars
  └─→ Telegram API / Gmail reply
```

### Outbound IPC (Agent → Host → Channel)

```
Agent writes JSON file to /workspace/ipc/{groupFolder}/messages/ or /tasks/
  │  (container path maps to data/ipc/{groupFolder}/ on host)
  ▼
startIpcWatcher()  [ipc.ts] — polls data/ipc/ every IPC_POLL_INTERVAL (1s)
  │
  ├─ messages/ file:
  │    { type: 'message', chatJid, text }
  │    { type: 'message', chatJid, text, sender }  [for agent teams]
  │    { type: 'message_with_buttons', chatJid, text, buttons }
  │    → if sender + Telegram + pool available: sendPoolMessage()
  │    → else: channel.sendMessage() or channel.sendMessageWithButtons()
  │
  └─ tasks/ file (processTaskIpc()):
       schedule_task → db.createTask()
       pause/resume/cancel/update_task → db.updateTask*()
       register_group → db.setRegisteredGroup()  [main group only]
       todo_create/update/complete/subtask → todo.ts functions
```

### Scheduled Task Flow

```
startSchedulerLoop()  [task-scheduler.ts] — polls every 60s
  │  getDueTasks() + getDeltronReminders() [db.ts + todo.ts]
  ▼
queue.enqueueTask(task)  [group-queue.ts]
  │  Deduplicates by task ID
  ▼
runTask(task)  [task-scheduler.ts]
  │  Runs runContainerAgent() in 'isolated' session context
  │  Updates next_run via computeNextRun() (drift-free anchor)
  └─ Output routed to task.chat_jid via channel.sendMessage()
```

---

## Key Files — Detailed Responsibilities

### `src/dashboard/server.ts` — Dashboard HTTP Server
Provides the web dashboard entry point.
- `startDashboardServer(port, bindHost, deps)`: creates Express app + http.Server, attaches WebSocket server on `/ws/chat`
- Route order: `GET /api/health` → `app.use('/api', groupsRouter)` → `app.use('/api', logsRouter())` → `express.static(dashboard/dist/)` → SPA catch-all
- Returns `http.Server` — caller owns the lifecycle (no SIGTERM handler inside)
- Port default 3030 (via `DASHBOARD_PORT` env var), binds to `0.0.0.0` by default

### `src/dashboard/routes/groups.ts` — Groups API
- `GET /api/groups`: queries `registered_groups` table, returns JSON array with LIMIT 100
- Fields returned: `jid`, `name`, `folder`, `isMain`, `requiresTrigger`

### `src/dashboard/routes/logs.ts` — Logs API
- `GET /api/logs`: reads `logs/nanoclaw.log`, returns last 200 parsed entries as JSON array
- Parses pino-pretty TEXT format (not JSON) — strips ANSI codes, merges continuation lines
- Missing or unreadable log file returns 200 empty array (never 500)
- Exports `parseLogLines(rawLines)` for unit testing

### `dashboard/` — React/Vite SPA
- Vite 8 + React 19 + TypeScript + Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- `dashboard/src/App.tsx`: sidebar layout with 10 nav items; Logs nav item renders LogsPanel
- `dashboard/src/components/LogsPanel.tsx`: log viewer — 5s auto-refresh, client-side level filter, smart auto-scroll
- `dashboard/vite.config.ts`: proxies `/api` and `/ws` to `http://localhost:3030` in dev mode
- Build output: `dashboard/dist/` (served by Express `express.static`)
- Build command: `npm run build:dashboard` (from root) or `npm run build` (from dashboard/)

### `src/index.ts` — Orchestrator
The entry point. Calls everything else. Key responsibilities:
- `main()`: init DB, start credential proxy, start dashboard server, start container runtime, connect channels, start message loop + IPC watcher + scheduler
- `startMessageLoop()`: polls for new messages, applies trigger/sender filtering, dispatches to queue
- `processGroupMessages()`: builds XML prompt, calls `runAgent()`
- `runAgent()`: wraps `runContainerAgent()`, tracks sessions, streams output back to channel
- Owns in-memory state: `lastTimestamp`, `sessions`, `registeredGroups`, `lastAgentTimestamp`

### `src/types.ts` — Type Contracts
All shared interfaces. If you add a new channel capability or change how groups work, start here.
- `Channel`: `connect()`, `sendMessage()`, `sendMessageWithButtons()`, `setTyping()`, `isConnected()`, `ownsJid()`, `disconnect()`
- `RegisteredGroup`: `{ jid, name, folder, triggerPattern, isMain, containerConfig }`
- `NewMessage`: `{ id, chat_jid, sender, sender_name, content, timestamp, is_from_me }`
- `ScheduledTask`: `{ id, group_folder, chat_jid, prompt, schedule_type, schedule_value, next_run, status }`

### `src/db.ts` — All SQLite Operations
Single source of truth for persistence. The DB lives at `store/messages.db`.

**Tables:**
| Table | Purpose |
|-------|---------|
| `chats` | Chat metadata (jid, name, channel, is_group) |
| `messages` | Full message history with timestamps |
| `registered_groups` | Which groups/channels are active (jid → folder mapping) |
| `scheduled_tasks` | Cron/interval/once task definitions |
| `task_run_logs` | Execution history for scheduled tasks |
| `todo_items` | Task tracker items (assignee, priority, due date, reminder) |
| `todo_projects` | Project codes (POD, TSK, etc.) |
| `router_state` | Key-value store for persistent runtime state |
| `sessions` | Maps group_folder → Claude session ID |

**Key functions:** `getNewMessages()`, `getMessagesSince()`, `storeMessage()`, `getAllRegisteredGroups()`, `setRegisteredGroup()`, `getSession()`, `setSession()`, `createTask()`, `getDueTasks()`, `updateTaskAfterRun()`

### `src/container-runner.ts` — Agent Execution
Builds docker CLI args and spawns containers.

**Mount strategy:**
- Main group: `groups/{folder}` (rw), project root (ro), global dir (ro)
- Non-main groups: only their own folder + global (ro)
- Always: `data/sessions/{folder}/.claude/` → `/root/.claude/` (isolated sessions per group)
- Always: `data/ipc/{folder}/` → `/workspace/ipc/` (IPC namespace)
- Mount allowlist at `~/.config/nanoclaw/mount-allowlist.json` (outside project, tamper-proof)

**Output parsing:** Streams stdout looking for `---NANOCLAW_OUTPUT_START---` / `---NANOCLAW_OUTPUT_END---` markers. Everything between markers is sent back as agent output.

**Snapshot files written before each run:**
- `data/ipc/{folder}/tasks/tasks_snapshot.json` — open tasks
- `data/ipc/{folder}/groups_snapshot.json` — registered groups
- `data/ipc/{folder}/todo_snapshot.json` — open todos

### `src/ipc.ts` — Container ↔ Host Bridge
Polls `data/ipc/` for JSON files dropped by agents, executes them on the host, then deletes the file.

**Authorization model:** Each IPC file's source is identified by the group folder it came from. Only the `isMain` group can register other groups or refresh the group list. Non-main groups can only affect themselves.

**Message IPC types:** `message`, `message_with_buttons`

**Task IPC types:** `schedule_task`, `pause_task`, `resume_task`, `cancel_task`, `update_task`, `register_group`, `refresh_groups`, `todo_create`, `todo_update`, `todo_complete`, `todo_create_subtask`

### `src/task-scheduler.ts` — Scheduled Tasks
Polls `getDueTasks()` every 60s. Runs due tasks via `queue.enqueueTask()`. Also checks `getDeltronReminders()` for todos assigned to deltron that are due today (triggers at 9am).

**Schedule types:** `cron` (cron expression), `interval` (ms), `once` (ISO datetime)

**Session context:** `isolated` = fresh session each run; `group` = reuse group's persistent session

### `src/group-queue.ts` — Concurrency Manager
Prevents more than `MAX_CONCURRENT_CONTAINERS` (5) containers running simultaneously. Each group has one slot. State per group: `active`, `idleWaiting`, `pendingMessages`, `pendingTasks`, running process reference, retry count, `startedAt` timestamp. Public `getSnapshot()` method returns `ContainerSnapshot[]` used by dashboard stats and containers panel.

Key behaviour: when a container finishes and goes idle, the queue checks for pending tasks → pending messages → other waiting groups before deciding to keep or close it.

### `src/credential-proxy.ts` — Credential Isolation
Runs as HTTP server on `PROXY_BIND_HOST:3001` (docker0 bridge address on Linux/WSL). Containers talk to `http://host.docker.internal:3001` instead of real Claude API. The proxy injects the real API key or OAuth token. Containers never see credentials directly.

### `src/channels/telegram.ts` — Telegram Channel
- Uses `grammy` library. Patches `dns.lookup` globally to force IPv4 (WSL/IPv6 fix).
- Registered group JID format: `tg:{chatId}`
- **Bot pool for agent teams** (optional):
  - `initBotPool(tokens)` — initialize send-only Api instances (no polling)
  - `sendPoolMessage()` — route to pool bots with stable sender identity (round-robin assignment, sticky per sender/group)
  - Pool bots renamed via `setMyName()` to display agent team member names
  - Falls back to main bot if pool unavailable
- **Photo handling**: downloads and processes images via `processImage()` utility with vision support (stored in group dir)
- Handles voice messages: pipes OGG to `scripts/whisper_transcribe.py`
- Handles inline keyboard buttons: writes IPC file `{ type: 'message_with_buttons', ... }`
- IPC messages with `sender` field routed to pool (if available); otherwise fall back to main bot
- Message length limit: 4096 chars (auto-splits)

### `src/channels/gmail.ts` — Gmail Channel
- Polls Gmail API every 60s for unread primary-category emails
- Delivers emails as messages to the `isMain` group (not to a separate Gmail group)
- Stores thread metadata (sender, subject, Message-ID) in memory for reply construction
- Does **not** mark emails as read after processing (emails stay unread in inbox)
- JID format for threads: `gmail:{threadId}` (used only for reply routing)

### `src/channels/registry.ts` — Channel Factory
```typescript
registerChannel(name, factory)  // called at import time by each channel file
getChannelFactory(name)         // used by index.ts to instantiate channels
getRegisteredChannelNames()     // list all registered channels
```

---

## Database — `store/messages.db`

The only file that persists state between restarts. Contains all messages, group registrations, sessions, scheduled tasks, and todos.

**Registered groups (current):**
| JID | Name | Folder | isMain |
|-----|------|--------|--------|
| `tg:8514304397` | Tris | telegram_main | yes |
| `dc:1480878847221039200` | Deltron #main | discord_main | yes (inactive — Discord disabled) |

---

## Environment & Credentials

| Location | Purpose |
|----------|---------|
| `.env` | Host credentials: `CLAUDE_CODE_OAUTH_TOKEN`, `DISCORD_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN`, `ASSISTANT_NAME`, `TELEGRAM_BOT_POOL` (optional) |
| `data/env/env` | Container env file — must be kept in sync with `.env` via `cp .env data/env/env` |
| `~/.gmail-mcp/` | Gmail OAuth keys and tokens |
| `~/.config/nanoclaw/sender-allowlist.json` | Optional sender filtering config |
| `~/.config/nanoclaw/mount-allowlist.json` | Approved filesystem paths for container mounts |

**Bot pool configuration:**
- `TELEGRAM_BOT_POOL` — comma-separated list of bot tokens for agent team messaging
  - Each token creates a send-only Api instance (no polling)
  - Tokens are assigned round-robin to team members on first message, then sticky per sender/group
  - If empty, agent team messages fall back to main bot
  - Example: `TELEGRAM_BOT_POOL=123:ABCdef...,456:XYZabc...`

---

## Adding a New Channel

1. Create `src/channels/{name}.ts` implementing the `Channel` interface from `types.ts`
2. Call `registerChannel('{name}', factory)` at the bottom of the file
3. Add `import './{name}.js'` to `src/channels/index.ts`
4. Register a group in the DB (or add a `/register` CLI command) with the channel's JID format
5. Update this document

## Adding a New IPC Operation

1. Add the IPC type handler in `ipc.ts` → `processTaskIpc()`
2. Add authorization check (main-only vs any group)
3. Add corresponding DB/todo function if needed
4. Document the IPC type for agents in `container/skills/task-manager/SKILL.md`
5. Update this document

---

## Common Gotchas

- **Service restart required** after registering a new group via CLI — DB write doesn't update in-memory `registeredGroups`
- **`data/env/env` must mirror `.env`** — containers read from `data/env/env`, not `.env`
- **Container build cache** — `--no-cache` alone doesn't invalidate COPY steps; prune builder first: `docker builder prune`
- **WSL IPv6** — Telegram's grammy uses node-fetch which prefers IPv6 on WSL. Fixed by patching `dns.lookup` in `channels/telegram.ts`. Don't remove this patch.
- **WSL docker0 bridge** — credential proxy must bind to `172.17.0.1` (docker0), not `127.0.0.1`. Handled in `container-runtime.ts`.
- **Gmail isMain routing** — Gmail delivers emails to whichever group has `isMain: true`. With Discord disabled, this is Telegram.
- **Empty `data/nanoclaw.db` and `data/nanoclaw.sqlite`** — these are legacy/placeholder files. Real DB is `store/messages.db`.
