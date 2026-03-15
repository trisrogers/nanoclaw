# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Event-driven single-process orchestrator with pluggable message channels and isolated containerized agent execution.

**Key Characteristics:**
- Single Node.js orchestrator process receives inbound messages from multiple channels (Telegram, Gmail, Discord, WhatsApp)
- Messages route through SQLite database for persistence and trigger-based filtering
- Agent execution isolated in Docker containers with controlled filesystem and environment access
- Bi-directional IPC (inter-process communication) between container agents and host orchestrator via JSON files
- Per-group session isolation — each group maintains independent Claude session state
- Concurrent container execution with exponential backoff retry and queue-based concurrency control (max 5 concurrent)

## Layers

**Channel Layer:**
- Purpose: Translate platform-specific message APIs into unified message and chat metadata events
- Location: `src/channels/`
- Contains: Telegram (grammy), Gmail (Google APIs), Discord (discord.js), WhatsApp (third-party)
- Depends on: types.ts (Channel interface), registry.ts (self-registration)
- Used by: index.ts (main orchestrator)
- Pattern: Factory-based registration; channels self-register at import time via `registerChannel()`

**Message Persistence Layer:**
- Purpose: Store all messages, group registrations, sessions, tasks, todos in durable SQLite database
- Location: `src/db.ts`
- Database: `store/messages.db`
- Contains: chats, messages, registered_groups, sessions, scheduled_tasks, task_run_logs, todo_items, todo_projects, router_state
- Depends on: better-sqlite3, types.ts
- Used by: orchestrator, IPC handler, scheduler
- Pattern: Single source of truth; all state changes go through db.ts functions

**Routing & Dispatch Layer:**
- Purpose: Format messages for agent prompt, route agent output back to channels, manage message triggers
- Location: `src/router.ts`, `src/sender-allowlist.ts`
- Contains: XML message formatting, internal tag stripping, sender filtering, trigger pattern matching
- Depends on: types.ts, timezone.ts
- Used by: index.ts (message loop), ipc.ts (output routing)
- Pattern: XML format for agent context; strict sender/trigger authorization

**Container Execution Layer:**
- Purpose: Spawn and manage Docker containers for agent execution with controlled mounts and environment
- Location: `src/container-runner.ts`, `src/container-runtime.ts`, `src/mount-security.ts`
- Contains: Docker CLI abstraction, volume mount building, image detection, security validation, process streaming
- Depends on: child_process, types.ts, credential-proxy.ts, group-folder.ts
- Used by: index.ts (via runAgent), task-scheduler.ts (via queue)
- Pattern: Volume mounts validated against allowlist; main group gets project root (ro) + group folder (rw); non-main groups isolated to their folder only

**IPC Bridge Layer:**
- Purpose: Poll for JSON files from container agents (messages, tasks, todos) and execute them on host
- Location: `src/ipc.ts`
- Contains: File-based IPC protocol parser, authorization (main-only vs self), message/task dispatching
- Depends on: db.ts, todo.ts, channels
- Used by: main (as subsystem loop)
- Pattern: Polling filesystem; JSON files dropped by containers are executed then deleted; authorization by folder identity

**Concurrency Manager:**
- Purpose: Serialize container execution per group, enforce global concurrency limit, queue messages and tasks
- Location: `src/group-queue.ts`
- Contains: Per-group state machine (active/idle/waiting), task queue, message pendency tracking, exponential backoff
- Depends on: config (MAX_CONCURRENT_CONTAINERS)
- Used by: index.ts (processGroupMessages, startMessageLoop)
- Pattern: Fixed-size concurrency pool with per-group slot; priority: pending tasks > pending messages

**Credential Isolation:**
- Purpose: Inject API credentials into containers without exposing them directly
- Location: `src/credential-proxy.ts`
- Contains: HTTP proxy listening on `http://host.docker.internal:3001` (or `172.17.0.1:3001` on WSL)
- Depends on: detectAuthMode (OAuth vs API key logic)
- Used by: container-runner.ts (injects CLAUDE_CODE_CREDENTIALS_URL env var)
- Pattern: Containers never see `.env` (shadowed with /dev/null); proxy intercepts requests and adds Authorization header

**Configuration:**
- Purpose: Centralize all environment variables and derived constants
- Location: `src/config.ts`
- Contains: ASSISTANT_NAME, POLL_INTERVAL, SCHEDULER_POLL_INTERVAL, CONTAINER_TIMEOUT, IDLE_TIMEOUT, MAX_CONCURRENT_CONTAINERS, TRIGGER_PATTERN, TIMEZONE, TELEGRAM_BOT_POOL
- Depends on: env.ts, types.ts
- Used by: all subsystems
- Pattern: Single source for constants; secrets NOT read here (only via credential proxy)

**Task Management:**
- Purpose: Schedule and execute periodic/one-time tasks, manage todo items, send reminders
- Location: `src/task-scheduler.ts`, `src/todo.ts`
- Contains: Cron/interval/once schedule parsing, reminder delivery, todo CRUD, subtask tracking
- Depends on: db.ts, group-queue.ts, container-runner.ts
- Used by: main (via startSchedulerLoop)
- Pattern: Task scheduler polls every 60s; reminders fire at 9am in configured timezone; todos use Notion integration when available

**Telegram Bot Pool (Agent Teams):**
- Purpose: Route agent team member messages through distinct bot identities
- Location: `src/channels/telegram.ts`, `src/index.ts`
- Contains: sendPoolMessage(), initBotPool(), round-robin sender→token assignment
- Depends on: grammy library, types.ts
- Used by: ipc.ts (when message has `sender` field), index.ts (initialization)
- Pattern: Pool tokens from `TELEGRAM_BOT_POOL` env var; tokens assigned sticky per sender+group pair; falls back to main bot if pool unavailable

## Data Flow

**Inbound Message (Channel → Agent Container):**

1. Channel (Telegram/Gmail/Discord) receives message
2. Channel calls `onMessage(jid, message)` callback
3. `storeMessage()` saves to DB; `storeChatMetadata()` updates chat metadata
4. `startMessageLoop()` polls `getNewMessages()` every 2s
5. Checks trigger pattern (`@AssistantName` or `isMain` group)
6. Deduplicates by JID; applies sender allowlist filtering
7. `queue.enqueueMessageCheck(groupJid)` — respects concurrency limit
8. `processGroupMessages(groupJid)` executes:
   - Fetches message history via `getMessagesSince(chatJid, lastAgentTimestamp)`
   - Formats as XML via `formatMessages()`
   - Writes tasks/groups/todos snapshots to `data/ipc/{folder}/`
   - Calls `runContainerAgent(group, prompt, onOutput)`
9. Container execution:
   - Docker spawns container with mounts validated against allowlist
   - Container env injected via `data/env/env` file
   - CLAUDE_CODE_CREDENTIALS_URL → `http://host.docker.internal:3001` (or WSL bridge IP)
   - Stdout streamed looking for `---NANOCLAW_OUTPUT_START---` / `---NANOCLAW_OUTPUT_END---` markers
10. `onOutput(text)` callback:
    - Strips `<internal>...</internal>` tags via `formatOutbound()`
    - Calls `channel.sendMessage(jid, text)` to return to user
11. Container enters idle-waiting state; ready for piped messages or tasks

**Piped Messages (While Container Idle):**

1. New messages arrive while container is idle-waiting
2. `queue.sendMessage(groupJid, text)` writes JSON to `data/ipc/{folder}/input/`
3. Container reads input via MCP mechanism and processes synchronously
4. Output piped back via stdout markers
5. If more messages pending, cycle continues; else container waits for idle timeout

**Outbound IPC (Container → Host → Channel):**

1. Agent writes JSON file to `/workspace/ipc/messages/` or `/workspace/ipc/tasks/`
2. (Container paths map to `data/ipc/{groupFolder}/` on host)
3. `startIpcWatcher()` polls every 1s
4. For **messages/TYPE files:**
   - `{ type: 'message', chatJid, text }` → `channel.sendMessage()`
   - `{ type: 'message', chatJid, text, sender }` → `sendPoolMessage()` if pool available + Telegram
   - `{ type: 'message_with_buttons', chatJid, text, buttons }` → `channel.sendMessageWithButtons()`
5. For **tasks/TYPE files:**
   - `schedule_task` → `createTask()`
   - `pause_task`, `resume_task`, `cancel_task`, `update_task` → `updateTask*()`
   - `register_group` → `setRegisteredGroup()` (main-only)
   - `refresh_groups` → triggers `syncGroups()` on all channels (main-only)
   - `todo_*` → todo CRUD functions
6. File deleted after processing

**Scheduled Task Execution:**

1. `startSchedulerLoop()` polls `getDueTasks()` every 60s
2. Also checks `getDeltronReminders()` for todos due today at 9am
3. `queue.enqueueTask(groupJid, taskId, runTaskFn)`
4. Task runs in isolated session context (no persistent state carryover)
5. Output piped to task's `chat_jid` via `channel.sendMessage()`
6. `computeNextRun()` calculates drift-free next occurrence

**State Management:**

- **In-Memory State:** `index.ts` holds `sessions`, `registeredGroups`, `lastTimestamp`, `lastAgentTimestamp`
- **Persistent State:** All state saved to SQLite `store/messages.db`
- **Session State:** Each group folder has `.claude/` session isolated in `data/sessions/{folder}/.claude/`
- **IPC State:** Transient JSON files in `data/ipc/{folder}/` — created and deleted per request
- **Recovery:** On startup, `recoverPendingMessages()` checks for messages between `lastAgentTimestamp` and current time; re-enqueues them

## Key Abstractions

**Channel Interface:**
- Purpose: Unified contract for all message platforms
- Examples: `src/channels/telegram.ts`, `src/channels/gmail.ts`, `src/channels/discord.ts`, `src/channels/whatsapp.ts`
- Pattern: Factories register at import time; orchestrator connects all registered channels at startup; each channel owns specific JID format (e.g., `tg:12345`, `gmail:threadId`)
- Methods: `connect()`, `sendMessage()`, `sendMessageWithButtons()` (optional), `setTyping()` (optional), `syncGroups()` (optional), `ownsJid()`, `isConnected()`, `disconnect()`

**RegisteredGroup:**
- Purpose: Bind a channel JID to a group folder and execution policy
- Examples: Telegram main group → `telegram_main` folder, non-main group → `group_name` folder
- Pattern: JID → folder mapping stored in DB; folder path resolved and validated at registration time; `isMain` flag grants elevated IPC privileges
- Fields: `jid`, `name`, `folder`, `trigger` (legacy, unused), `requiresTrigger`, `isMain`, `containerConfig` (additional mounts, timeouts)

**ScheduledTask:**
- Purpose: Define periodic or one-time agent execution
- Examples: Cron (`0 9 * * *`), Interval (`86400000` ms), Once (`2026-03-20T09:00:00Z`)
- Pattern: Stored in DB; next_run computed via drift-free anchor; runs in isolated session context
- Context modes: `group` (reuse persistent session), `isolated` (fresh session each run)

**MountAllowlist:**
- Purpose: Security boundary — restrict which host paths containers can access
- Location: `~/.config/nanoclaw/mount-allowlist.json` (outside project, tamper-proof)
- Pattern: Allowlist-based with glob blocklists; main group can access allowlisted roots (ro or rw depending on config); non-main groups always read-only if outside their folder

## Entry Points

**Main Orchestrator:**
- Location: `src/index.ts`
- Triggers: `npm run dev` or systemd service
- Responsibilities:
  - Initialize DB, start credential proxy, start container runtime
  - Connect all registered channels
  - Start message loop (polls DB every 2s)
  - Start IPC watcher (polls filesystem every 1s)
  - Start scheduler loop (polls DB every 60s)
  - Handle /remote-control and /new commands
  - Graceful shutdown on SIGTERM/SIGINT

**Channel Connections:**
- Each channel implements `Channel` interface
- Self-registers via `registerChannel(name, factory)` at import
- Factory called at startup; returns `null` if credentials missing
- Once connected, channels emit via `onMessage(jid, message)` callback

**Container Agent:**
- Location: `container/agent-runner/` (inside Docker image)
- Entry point: `src/index.ts` (compiled from TypeScript in container build)
- Receives via: stdin (formatted XML messages) and `data/ipc/{folder}/input/` (JSON follow-up messages)
- Produces via: stdout (marked with output sentinels) and `data/ipc/{folder}/messages/` + `data/ipc/{folder}/tasks/` (JSON commands)

## Error Handling

**Strategy:** Exponential backoff with human-visible failures; failed states recovered on next trigger.

**Patterns:**

- **Message Processing Error:** Rolls back message cursor (unless output already sent to user); re-enqueues with exponential backoff up to 5 retries; error logged to `logs/`
- **Container Timeout:** Process killed after CONTAINER_TIMEOUT (1800s default); logged as timeout error; message cursor rolled back
- **IPC Parse Error:** File skipped; error logged; poll continues
- **IPC Authorization Failure:** Rejected silently; warning logged; no action taken
- **Channel Disconnect:** Logged as warn; channels reconnect on next cycle
- **DB Error:** Fatal; process exits with error (assumed DB corruption or permission issue)

**Patterns for Operators:**

- Check `logs/*.log` (Pino JSON format) for detailed error context
- View task run history via `npx tsx scripts/tasks.ts list` (includes last_result, last_run)
- Use `/remote-control` command (main group only) to debug container state

## Cross-Cutting Concerns

**Logging:** Pino logger at `src/logger.ts`; JSON output with uncaught exception handler; environment-aware (pretty-print in dev, JSON in prod via LOG_LEVEL)

**Validation:**
- Group folder paths validated against allowlist at registration
- Mount paths validated via `mount-security.ts` (prevents escape attempts)
- Sender allowlist checked before storing messages (drop mode blocks non-allowed senders)
- IPC message authorization checked by group folder identity

**Authentication:**
- Channels authenticate with their respective platforms (Telegram token, Gmail OAuth, Discord token)
- Credentials stored in `.env` (never committed); loaded via credential proxy only
- Containers never see `.env` — proxy injects Authorization header on outbound API calls

**Timezone:**
- Configured via `TIMEZONE` env var or system default
- Used for message formatting timestamps, cron expressions, reminder scheduling
- All scheduled task times interpreted in configured timezone

**Concurrency:**
- Single orchestrator process (Node.js is single-threaded)
- Multiple container execution: queue enforces max 5 concurrent (configurable)
- Per-group serialization: no two containers run same group simultaneously
- Database: concurrent reads allowed; writes serialized by better-sqlite3 (WAL mode)

---

*Architecture analysis: 2026-03-15*
