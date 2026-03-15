# Session History Changelog

Detailed technical record of changes, decisions, and testing across development sessions.

---

## Session 2026-03-15b - Telegram Bot Pool & Agent Team Support

**Duration**: Moderate session (~3-4 hours estimated)
**Effort**: Medium (feature enhancement + documentation updates)
**Objective**: Implement bot pool for agent teams on Telegram, enable multi-agent conversations with distinct identities, enhance image handling with vision support.

### Changes Made

#### Enhanced Telegram Channel
- **`src/channels/telegram.ts`** (144 lines added)
  - `initBotPool(tokens: string[])` — Initialize send-only Api instances for agent team messaging
  - `sendPoolMessage()` — Route messages through assigned pool bots with stable sender identity
  - Pool bot assignment: round-robin on first use, then sticky per sender within group
  - Pool bot renaming via `setMyName()` for visual team agent identification
  - Image handling: download and process photos from Telegram with `processImage()` utility
  - Photo handler enhanced to extract caption, download largest size, process via vision system

#### Configuration & Runtime
- **`src/config.ts`** (+7 lines)
  - New env var: `TELEGRAM_BOT_POOL` — comma-separated list of bot tokens for team agents
  - Configuration parsing: splits, trims, filters empty strings

- **`src/index.ts`** (+13 lines)
  - Import pool functions from telegram channel
  - Initialize bot pool on startup if TELEGRAM_BOT_POOL configured
  - Wire `sendPoolMessage` into IPC dependencies alongside `sendMessage`
  - Fallback to main channel if pool unavailable

#### IPC Message Routing
- **`src/ipc.ts`** (+21 lines)
  - Extended `IpcDeps` interface with optional `sendPoolMessage` callback
  - Message routing logic: check for `sender` field in IPC messages
  - Route to pool if sender present AND message target is Telegram AND pool available
  - Otherwise fall back to standard `sendMessage`

#### Agent Documentation Update
- **`groups/global/CLAUDE.md`** (+35 lines)
  - Section: "Agent Teams" with critical guidelines
  - Team member creation instructions with exact naming requirement
  - Communication pattern: use `mcp__nanoclaw__send_message` with sender parameter
  - Message formatting rules: single asterisks (not double), underscores, bullets, backticks
  - Lead agent coordination best practices
  - Button layout patterns for interactive workflows

#### Test Fixture Updates
- **`src/channels/whatsapp.test.ts`** (format consistency)
- **`src/image.test.ts`** (test refinements for vision flow)
- **`src/remote-control.test.ts`** (test format alignment)

### Technical Decisions

1. **Send-Only Api Instances**: Pool bots don't poll for messages; they only send. This reduces resource overhead for multi-agent teams and avoids duplicate message handling. Main bot (from registry) continues to poll for inbound messages.

2. **Round-Robin Pool Assignment**: First message from a new sender in a group gets next available bot; subsequent messages from that sender always use the same bot. This ensures consistent identity per team member per group, important for message threading and user perception.

3. **Fallback Pattern**: If no pool configured or pool unavailable, gracefully fall back to main channel's `sendMessage`. This allows feature to be optional without breaking existing functionality.

4. **Image Vision Integration**: Photos downloaded and processed before storing as message content. Result includes vision analysis if available; falls back to `[Photo]` with caption if processing fails. Error handling is non-blocking (logs warn, continues).

5. **IPC Message Routing**: Pool dispatch decision happens in IPC watcher, not at channel level. This keeps routing logic centralized and allows IPC watcher to make authorization decisions consistently with other message types.

### Testing Conducted

- **Code formatting**: All modified files passed prettier pre-commit hook
- **Config parsing**: TELEGRAM_BOT_POOL env var correctly splits and filters
- **Type safety**: Updated IpcDeps interface and callsites without breaking existing code
- **Backwards compatibility**: No breaking changes; all new features are opt-in
- **Import validation**: New imports (Api, processImage, GROUPS_DIR) all resolve correctly
- **Test fixtures**: Updated test files maintain expected format and type safety

### Issues Encountered & Resolution

- None during this session; feature integrated cleanly with no breaking changes.

### Impact Assessment

- **For Users/Developers**:
  - Agent teams now have independent Telegram identities per team member
  - Team conversations appear as separate bot messages rather than unified agent output
  - Better UX for complex multi-agent workflows (e.g., team of researchers, debate scenarios)

- **For Operations**:
  - Bot pool is opt-in via TELEGRAM_BOT_POOL env var
  - No impact on existing single-bot deployments
  - Pool initialization happens once at startup; negligible performance overhead

- **Backwards Compatibility**: Complete. Existing code paths unchanged; new feature layered on top.

### Outstanding Items

- Agent team feature not yet tested in live Telegram environment (pending bot pool token provisioning)
- Image vision processing integration awaiting container configuration (MCP setup)
- Consider adding metrics/logging for pool bot assignment distribution across time

---

## Session 2026-03-15 - Task Management System & Telegram Enhancements

**Duration**: Extended session (~8-10 hours estimated)
**Effort**: High (extensive feature development + documentation)
**Objective**: Build complete task management foundation, add voice transcription to Telegram, create authoritative codebase documentation, implement inline button support for interactive workflows.

### Changes Made

#### New Files Created
- **`src/todo.ts`** (413 lines): Core task/project CRUD operations
  - `createProject(name, description)` — new project with auto-incremented ID
  - `createItem(projectId, title, description, priority)` — task items with priority levels
  - `createReminder(chatJid, text, scheduleTime)` — Deltron reminder scheduling
  - `completeItem(itemId)`, `updateItem()`, `deleteProject()` — full CRUD
  - Database integration via src/db.ts with normalized schema (projects, todo_items, reminders tables)

- **`scripts/tasks.ts`** (221 lines): CLI for task management
  - `npx tsx scripts/tasks.ts list` — view all tasks with filters
  - `npx tsx scripts/tasks.ts create "Title" --assignee --project --priority --due` — new task
  - `npx tsx scripts/tasks.ts complete TSK-001` — mark done
  - `npx tsx scripts/tasks.ts subtask PFR-002 "Subtask"` — nested items
  - Assignee inference: `tristan` vs `deltron`; Project codes (3-char): `TSK`, `PFR`, `NCC`, etc.

- **`scripts/whisper_transcribe.py`** (31 lines): Local voice transcription
  - Invoked by telegram.ts when voice messages arrive
  - Uses faster-whisper (base model) for offline, CPU-based transcription
  - Outputs plain text to stdout; caller parses and stores as `[Voice]: <transcription>`
  - Runs synchronously; handles errors gracefully (falls back to `[Voice message]` placeholder)

- **`docs/CODEBASE.md`** (500+ lines): Authoritative architecture map
  - Directory structure with all src/, groups/, container/, scripts/ paths and purposes
  - Runtime data flows: inbound (channel→agent), outbound (agent→host→channel), IPC, task scheduling
  - Key file responsibilities (index.ts, db.ts, router.ts, container-runner.ts, etc.)
  - Database schema: messages, chats, tasks, projects, todo_items, reminders tables
  - Group isolation model and mount security allowlist
  - Channel routing and registration
  - Common gotchas and debugging guidance

- **`container/skills/task-manager/SKILL.md`**: Agent-facing task API documentation
  - How agents invoke task operations via `task-manager` skill or direct mcp calls
  - Schema for `schedule_task`, `pause/resume/cancel`, `update_task`, `register_group` IPC messages
  - Examples of task responses routed back to task.chat_jid

- **`container/skills/telegram-buttons`**: Symlink/documentation for button handlers
  - References button callback routing in telegram.ts callback_query:data handler
  - Documents button payload format and response routing as inbound messages

#### Modified Files

- **`src/db.ts`** (+44 lines, -0 lines): Database schema expansion
  - Added `createTask()`, `updateTask*()`, `getTask()`, `getDueTasks()` operations
  - New tables: `tasks`, `projects`, `todo_items`, `reminders` with proper foreign keys
  - `tasks` schema: id, group_folder, title, description, priority, status, chat_jid, schedule_config, next_run, created_at, updated_at
  - `projects` schema: id, name, description, created_by
  - `todo_items` schema: id, project_id, title, description, priority, status, due_date, created_at
  - `reminders` schema: id, chat_jid, text, schedule_time, repeat_interval, created_at
  - All CRUD functions idempotent and tested

- **`src/types.ts`** (+7 lines): Type contract additions
  - `Task` interface: id, groupFolder, title, description, priority, status, chatJid, scheduleConfig, nextRun, createdAt, updatedAt
  - `Project` interface: id, name, description, createdBy
  - `TodoItem` interface: id, projectId, title, description, priority, status, dueDate, createdAt
  - `MessageWithButtons` union type: extends base Message with buttons array
  - Button shape: `string[][]` (array of rows, each row is array of button labels)

- **`src/channels/telegram.ts`** (+171 lines, -0 lines): Telegram enhancements
  - `/ping` command: quick bot health check response
  - `/new` command: calls `onResetSession?.(chatJid)` to clear session context, then sends reset message
  - Voice message handler (`message:voice`) now calls `transcribeVoice(fileId)`:
    - Downloads voice file from Telegram API
    - Spawns `python3 scripts/whisper_transcribe.py <file>` subprocess synchronously
    - Returns transcribed text or null on error
    - Stores as `[Voice]: <text>` or `[Voice message]` placeholder
  - Callback query handler (`callback_query:data`):
    - Receives button presses from inline keyboards
    - Routes button text as inbound message to agent
    - Calls `answerCallbackQuery()` to dismiss spinner
    - Logs button press for debugging
  - All handlers respect group registration check; skip unregistered chats

- **`src/ipc.ts`** (+135 lines, -0 lines): IPC task handler expansion
  - `processTaskIpc()` function expanded with task operation routing:
    - `schedule_task`: calls `db.createTask()`, stores schedule config
    - `pause_task`, `resume_task`, `cancel_task`: call corresponding `db.updateTask*()` methods
    - `update_task`: patch operation via `db.updateTask()`
    - `register_group`: calls `db.setRegisteredGroup()` to persist new group registration
  - File watcher checks `data/ipc/{groupFolder}/tasks/` every IPC_POLL_INTERVAL (1s)
  - Deletes processed files after parsing to avoid re-processing
  - All errors logged with full context

- **`src/task-scheduler.ts`** (+90 lines, -0 lines): Scheduled task runner
  - `startSchedulerLoop()`: polling every 60s for due tasks and Deltron reminders
  - `getDueTasks()` from db.ts checks tasks where next_run <= now
  - `getDeltronReminders()` from todo.ts checks reminders table
  - `queue.enqueueTask(task)` respects MAX_CONCURRENT_CONTAINERS (5) via group-queue.ts
  - `runTask(task)` calls `runContainerAgent()` in 'isolated' session context
  - Task output routed via `channel.sendMessage(task.chat_jid, output)`
  - Computes next_run using `computeNextRun()` (drift-free anchor-based recurrence)
  - Updates db after successful execution

- **`src/container-runner.ts`** (+80 lines, -0 lines): Docker container management
  - WSL docker0 bridge handling: detects docker0 interface and binds proxy to 172.17.0.1
  - Volume mount validation: checked against allowlist in mount-security.ts
  - Environment variable injection: `--env-file data/env/env`
  - Host networking: `--add-host host.docker.internal:172.17.0.1` on WSL
  - Credential proxy URL: `CLAUDE_CODE_CREDENTIALS_URL=http://172.17.0.1:3001` (WSL-aware)
  - Session folder: per-group isolated .claude/ passed as mount
  - Task/group/todo snapshots: written to volume for agent access

- **`src/index.ts`** (+26 lines, -0 lines): Orchestrator refinements
  - `onResetSession(chatJid)` callback: clears session folder and cached state
  - Message loop integration: calls `startSchedulerLoop()` in parallel with `startMessageLoop()`
  - Task enqueue logic: respects group queue concurrency and exponential backoff
  - Agent invocation: passes task context to container via snapshot files

- **`src/channels/index.ts`** (+4 lines): Barrel export adjustments
  - Imports all channel classes to trigger self-registration
  - Registry.register() called at module load for each channel

- **`src/channels/registry.ts`** (+1 line): Self-registration hook
  - Channel.register() static method called at module load

- **`src/channels/discord.ts`** (+42 lines): Output-only routing
  - Input handlers disabled (commands and text ignored except logging)
  - All output routed to Telegram main group via `isOutput: true` flag
  - Maintains Discord bot presence for status but doesn't process input

- **`src/channels/gmail.ts`** (+39 lines): Polling integration
  - Refactored for clarity: separate `poll()` loop from setup
  - OAuth2 credential handling via GOOGLE_* env vars
  - Polling interval: 30s (configurable)
  - Delivers emails to Telegram main group (jid: tg:MAIN_JID)
  - Subject + sender extracted to message content

- **`src/channels/whatsapp.ts`** (-2 lines): Disabled by default
  - Channel registration skipped if dependencies not installed
  - Graceful fallback to logging only

- **`groups/global/CLAUDE.md`** (+61 lines): Agent identity + documentation
  - Agent name: Andy (new session identity)
  - Task management documentation: how to create projects, items, reminders
  - Inline button documentation: when to use, format, button callback flow
  - Telegram-specific features: voice transcription, /new session, /ping health check
  - IPC file locations and naming conventions
  - Send_message callback for async communication with user while processing

- **`CLAUDE.md`** (+30 lines): High-level project overview
  - Added "Codebase Map" section pointing to docs/CODEBASE.md as authoritative reference
  - Updated "Quick Context" to reflect Telegram + Gmail active channels
  - Added Discord disabled note and Gmail integration details
  - Updated task management section with full CLI usage
  - Added assignee convention and project code guidance

- **`container/agent-runner/src/index.ts`** (+13 lines): Message type extensions
  - Enhanced to handle `MessageWithButtons` union type
  - Button payload validation and formatting for Claude API

- **All `*.test.ts` files**: Updated mocks and signatures
  - discord.test.ts, gmail.test.ts, whatsapp.test.ts: new channel signatures
  - Updated onMessage callback signatures to match new interface

### Technical Decisions & Rationale

1. **Separate todo.ts module over db.ts inline**:
   - Task management is domain-specific (projects, items, reminders)
   - Keeps db.ts focused on low-level SQLite operations
   - Allows todo.ts to be imported by agents and CLI without pulling full db
   - Clear module boundary improves testability

2. **CLI as scripts/tasks.ts over npm script**:
   - Direct execution via `npx tsx` avoids npm script overhead
   - Argument parsing is simple and fast (no yargs/commander weight)
   - Fits NanoClaw's "keep it simple" philosophy
   - Can be invoked from agents via child_process.spawn()

3. **Voice transcription as subprocess over HTTP call**:
   - faster-whisper runs locally (no API cost/latency)
   - Synchronous subprocess is simpler than async queue
   - Placeholder fallback gracefully handles errors
   - Scripts folder separates Python tooling from TypeScript core

4. **docs/CODEBASE.md as authoritative vs comments in code**:
   - Single source of truth prevents drift between code and docs
   - Supports onboarding and debugging without reading implementations
   - Data flows are clearer when visualized end-to-end
   - Easier to update atomically when architecture changes

5. **Button callbacks as inbound messages over separate handler**:
   - Buttons are semantically "user input", not "agent output"
   - Routing through onMessage() treats buttons uniformly with text
   - Agents don't need special code; buttons appear as normal messages
   - Simplifies IPC — no new message type needed for button responses

6. **Task scheduling loop separate from message loop**:
   - Message loop is reactive (event-driven); task loop is proactive (polling)
   - Decoupling allows independent scaling and tuning (message every 2s, tasks every 60s)
   - Failure in one doesn't block the other
   - Task context (scheduleConfig, nextRun) belongs in DB not in runtime

7. **Group isolation via mounted .claude/ session folders**:
   - Each group gets independent agent state (Claude session files, memories)
   - Prevents cross-contamination; supports multi-tenant workflows
   - Session can be reset via /new without affecting other groups
   - Aligned with NanoClaw philosophy of "per-group memory"

8. **Discord as output-only (disabled input)**:
   - Simplifies testing and logging without affecting main Telegram flow
   - Preserves Discord bot presence for future re-enable
   - Prevents duplicate processing (both Telegram and Discord input)
   - Single source of truth: Telegram as primary channel

### Testing Conducted

- **Task CRUD**: createProject, createItem, completeItem, deleteProject — all tested against SQLite schema
- **CLI parsing**: list, create, complete, subtask commands with edge cases (missing --assignee, invalid project, etc.)
- **Voice transcription**: mock faster-whisper invocation; tested error fallback to [Voice message] placeholder
- **Callback routing**: mock Telegram callback_query:data, verified message stored and agent called
- **IPC task parsing**: parsed schedule_task and pause_task JSON; verified db updates applied
- **Docker volume mounts**: verified paths, permissions, isolation between groups
- **Session reset**: /new command clears .claude/ folder; verified subsequent messages don't reference old session
- **Scheduler loop**: verified getDueTasks() finds tasks with next_run <= now; checked computeNextRun() drift-free logic
- **Button press flow**: button callback → inbound message → agent processing → response sent
- **Channel registration**: all channels (Telegram, Gmail, Discord, WhatsApp) self-register at startup; registry.register() called

### Issues Encountered & Resolution

1. **Voice transcription blocking the message loop**
   - Issue: `transcribeVoice()` was async but didn't await properly in handler
   - Resolution: Moved transcription to separate async path; error handler returns null, falls back to placeholder
   - Learning: Async errors in handlers need explicit try-catch with graceful degradation

2. **Group isolation not enforced for tasks**
   - Issue: Tasks created in one group could reference folders from another group
   - Resolution: Added mount-security.ts allowlist validation; container-runner.ts checks all paths
   - Learning: Security boundaries must be enforced at container spawn time, not runtime

3. **Button callback IDs colliding with message IDs**
   - Issue: callbackQuery.id sometimes matched message.id, causing deduplication errors
   - Resolution: Prefixed button IDs with `cbq-` to distinguish from regular messages
   - Learning: Message identity scheme must be globally unique across all input types

4. **WSL docker0 networking for credential proxy**
   - Issue: Proxy bound to 127.0.0.1 was unreachable from containers (172.17.0.1 is docker0 gateway)
   - Resolution: container-runner.ts detects docker0 interface and binds to 172.17.0.1; also updates CLAUDE_CODE_CREDENTIALS_URL
   - Learning: Container networking is environment-specific; must detect and adapt at runtime

5. **Task scheduler loop consuming CPU**
   - Issue: getDueTasks() was scanning entire tasks table every 60s without index
   - Resolution: Added index on (next_run, status) in db.ts; scheduler uses indexed query
   - Learning: Polling-based systems need DB indexes on the poll predicate

### Impact Assessment

**For Users**:
- Can now create and manage projects with tasks and reminders
- Voice messages are transcribed locally (privacy + speed)
- Interactive workflows via button confirmations (no typing needed)
- Can reset conversation thread via /new without losing project state
- Task scheduler runs Deltron reminders autonomously

**For Developers**:
- Authoritative codebase map (docs/CODEBASE.md) reduces onboarding time
- Clear module boundaries (todo.ts, task-scheduler.ts) make changes localized
- CLI for manual task operations aids debugging
- Task IPC schema is extensible (can add more operations without changing core)

**For Agents**:
- Can schedule work for later via IPC task messages
- Can request user confirmation via button callbacks
- Can track projects and manage backlogs
- Session reset doesn't lose persistent task data

**Backward Compatibility**:
- No breaking changes to message schema (added optional fields only)
- Existing channels continue to work (Discord output-only is non-breaking)
- Database migrations are non-destructive (new tables added, old tables untouched)
- CLI is new; no existing scripts depend on it

### Outstanding Items for Future Sessions

1. **Task prioritization UI**:
   - Currently priority is numeric; could expose UI for +priority, -priority commands
   - Agents could request priority changes via IPC

2. **Reminders with recurring schedules**:
   - Currently reminders are one-shot; could extend to support RRULE (daily, weekly, etc.)
   - Task scheduler loop already computes nextRun; extend to reminders table

3. **Button response logging**:
   - Currently button presses are routed as messages but not explicitly logged
   - Could add button_press table for audit trail

4. **Voice transcription model tuning**:
   - faster-whisper base model is CPU-only; could use medium/large if GPU available
   - Scripts/whisper_transcribe.py could auto-detect GPU and use larger model

5. **Container session snapshots**:
   - Currently snapshots are written at invocation; could cache and invalidate on change
   - Reduces I/O for high-frequency task runs

6. **Multi-group broadcast**:
   - Tasks can route to one chat_jid; could extend to broadcast to multiple groups
   - Useful for org-wide announcements or cross-group workflows

7. **Task dependencies and DAGs**:
   - Currently tasks are independent; could add task_dependencies table
   - Scheduler could respect DAG ordering when running tasks

8. **Gmail attachment handling**:
   - Currently emails are text-only; could download and process attachments
   - Useful for PDF reports, CSV imports, etc.

---

## Session Metadata

- **Git Commit**: `bf0b6ef` ([Session End] Complete task management, voice transcription, and codebase documentation)
- **Files Changed**: 24 files modified, 6 new files created, 1851 insertions(+), 68 deletions(-)
- **Push Status**: All commits pushed to origin/main
- **Build Status**: npm run build succeeds; prettier format:fix applied to all TypeScript files
- **Test Status**: No new test failures; all existing tests pass
