# Codebase Structure

**Analysis Date:** 2026-03-15

## Directory Layout

```
nanoclaw/
├── src/                           # Host orchestrator (TypeScript, Node.js)
│   ├── index.ts                   # Main entry point: orchestrator, message loop, agent dispatch
│   ├── types.ts                   # All shared type interfaces
│   ├── config.ts                  # Environment variables and derived constants
│   ├── router.ts                  # Message formatting (XML) and outbound routing
│   ├── db.ts                      # SQLite operations (messages, groups, tasks, todos)
│   ├── ipc.ts                     # IPC watcher — polls for agent output and commands
│   ├── container-runner.ts        # Spawns Docker containers with mounts and env
│   ├── container-runtime.ts       # Docker CLI abstraction (detection, runtime fixes)
│   ├── credential-proxy.ts        # HTTP proxy for credential injection
│   ├── group-queue.ts             # Concurrency manager (max 5 concurrent containers)
│   ├── group-folder.ts            # Group folder path resolution and validation
│   ├── sender-allowlist.ts        # Optional sender filtering (drop/allow modes)
│   ├── task-scheduler.ts          # Polls and executes scheduled tasks (cron/interval/once)
│   ├── todo.ts                    # Todo/task CRUD (projects, items, reminders)
│   ├── image.ts                   # Image processing (download, resize, vision parsing)
│   ├── logger.ts                  # Pino JSON logger
│   ├── remote-control.ts          # Session inspection/debugging server
│   ├── mount-security.ts          # Mount allowlist validation
│   ├── env.ts                     # .env file loader
│   ├── timezone.ts                # Timezone utilities
│   │
│   ├── channels/                  # Channel implementations (pluggable)
│   │   ├── index.ts               # Barrel import (triggers all channels to self-register)
│   │   ├── registry.ts            # Channel factory registry
│   │   ├── telegram.ts            # Telegram bot (grammy library)
│   │   ├── gmail.ts               # Gmail polling (Google APIs)
│   │   ├── discord.ts             # Discord bot (disabled in current setup)
│   │   └── whatsapp.ts            # WhatsApp (separate fork)
│   │
│   ├── *.test.ts                  # Co-located unit tests (vitest)
│   └── *.test.ts (channels/)      # Channel tests
│
├── groups/                        # Per-group working directories (mounted rw into containers)
│   ├── global/CLAUDE.md           # Agent identity and system instructions (shared by all)
│   ├── telegram_main/             # Main Telegram group folder
│   │   ├── CLAUDE.md              # (Optional) group-specific overrides
│   │   ├── logs/                  # (Generated) group-specific logs
│   │   └── ...                    # Group's working files
│   ├── discord_main/              # Discord main group (disabled, not active)
│   └── {other groups}/            # Additional registered groups
│
├── data/                          # Runtime state and IPC (never committed, gitignored)
│   ├── ipc/                       # Inter-process communication between host and containers
│   │   └── {groupFolder}/
│   │       ├── messages/          # Outbound messages from agent
│   │       ├── tasks/             # Task/todo commands from agent
│   │       └── input/             # Piped messages to idle container
│   ├── sessions/                  # Isolated Claude session state per group
│   │   └── {groupFolder}/.claude/ # Mounted to /root/.claude/ in container
│   ├── env/                       # Container environment file (synced from .env)
│   │   └── env
│   └── *.db                       # Legacy DB files (ignore; real DB is store/messages.db)
│
├── store/                         # Persistent database
│   └── messages.db                # SQLite: single source of truth for all persistent state
│
├── container/                     # Docker image and agent container files
│   ├── Dockerfile                 # Image definition
│   ├── build.sh                   # Build script (invoke via ./container/build.sh)
│   ├── agent-runner/              # Claude Agent SDK runner
│   │   └── src/                   # Agent TypeScript code (mounted into container)
│   │       └── index.ts           # Agent entry point
│   └── skills/                    # Agent-side skill documentation and tools
│       ├── agent-browser/         # Browser automation via Bash
│       ├── task-manager/          # Task scheduling and todo management
│       └── pdf-reader/            # PDF extraction and analysis
│
├── scripts/                       # Utility scripts
│   ├── tasks.ts                   # CLI for task/todo management (npx tsx scripts/tasks.ts)
│   └── whisper_transcribe.py      # Local voice transcription (faster-whisper)
│
├── docs/                          # Documentation
│   ├── CODEBASE.md                # Comprehensive architecture and data flow reference
│   └── REQUIREMENTS.md            # Architecture decisions and rationale
│
├── .env                           # Environment variables (secrets; never committed)
├── .env.example                   # Example .env template
├── .prettierrc                    # Code formatter config
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── .nvmrc                         # Node version (v20)
├── vitest.config.ts               # Test runner configuration
│
└── logs/                          # (Generated) service logs

```

## Directory Purposes

**src/ — Host Orchestrator:**
- Purpose: All Node.js orchestrator logic
- Contains: Message routing, channel management, container spawning, IPC, DB operations
- Key files: `index.ts` (entry), `db.ts` (persistence), `ipc.ts` (agent communication)

**src/channels/ — Message Platforms:**
- Purpose: Platform adapters implementing unified `Channel` interface
- Contains: Telegram (grammy), Gmail (Google APIs), Discord (discord.js), WhatsApp (custom)
- Key files: `registry.ts` (factory registration), each channel self-registers at import

**groups/ — Working Directories:**
- Purpose: Per-group isolated filesystem mounted rw into containers
- Contains: Group-specific `CLAUDE.md` overrides, group logs, working files
- Key files: `groups/global/CLAUDE.md` (shared agent identity for all groups)

**data/ — Runtime IPC and Sessions:**
- Purpose: Transient state and container communication
- Contains: Snapshots written before each container run, input/output IPC JSON files, per-group session state
- Gitignore: All of `data/` (never committed; regenerated at runtime)

**store/ — Persistent Database:**
- Purpose: Single source of truth for all durable state
- Contains: SQLite `messages.db` with 8 tables (chats, messages, scheduled_tasks, registered_groups, sessions, todo_items, etc.)
- Never deleted; backed up offline if needed

**container/ — Docker Image:**
- Purpose: Container definition and agent code
- Contains: Dockerfile, agent TypeScript source (`agent-runner/`), skill documentation
- Key files: `Dockerfile` (image spec), `build.sh` (build entrypoint), `agent-runner/src/index.ts` (agent logic)

**scripts/ — Utility Tools:**
- Purpose: Command-line utilities for maintenance
- Contains: Task/todo CLI, voice transcription script
- Usage: `npx tsx scripts/tasks.ts`, `python scripts/whisper_transcribe.py`

**docs/ — Reference:**
- Purpose: Architecture documentation and decisions
- Key files: `CODEBASE.md` (read before major changes), `REQUIREMENTS.md` (design rationale)

## Key File Locations

**Entry Points:**
- `src/index.ts`: Main orchestrator (runs via `npm run dev` or systemd service)
- `container/agent-runner/src/index.ts`: Agent code inside Docker (runs inside each container)

**Configuration:**
- `src/config.ts`: All constants and env vars (ASSISTANT_NAME, POLL_INTERVAL, CONTAINER_TIMEOUT, etc.)
- `.env`: Secrets (API tokens, credentials) — never committed
- `~/.config/nanoclaw/mount-allowlist.json`: Container mount security policy (outside project)
- `~/.config/nanoclaw/sender-allowlist.json`: Sender filtering rules (outside project)

**Core Logic:**
- `src/index.ts`: Message loop, orchestration, agent dispatch, IPC coordination
- `src/db.ts`: All SQLite read/write operations
- `src/group-queue.ts`: Concurrency control and message/task queuing
- `src/container-runner.ts`: Docker container spawning with mount validation
- `src/ipc.ts`: Polling for agent output and task commands

**Channel Implementations:**
- `src/channels/telegram.ts`: Telegram bot (grammy, bot pool for agent teams)
- `src/channels/gmail.ts`: Gmail polling (Google APIs, OAuth2)
- `src/channels/discord.ts`: Discord bot (currently disabled)
- `src/channels/whatsapp.ts`: WhatsApp (separate fork)

**Testing:**
- `src/**/*.test.ts`: Co-located unit tests (vitest)
- `vitest.config.ts`: Test configuration

## Naming Conventions

**Files:**
- Kebab-case: `container-runner.ts`, `group-queue.ts`, `sender-allowlist.ts`
- Test files: `*.test.ts` suffix (same directory as source)
- Channel files: Singular platform name (`telegram.ts`, `gmail.ts`, `discord.ts`)

**Directories:**
- Kebab-case: `src/channels/`, `container/agent-runner/`, `container/skills/`
- Group folders: Snake_case: `telegram_main`, `discord_main`, `group_name`

**Functions and Variables:**
- Exported functions: camelCase starting with action verb: `startMessageLoop()`, `processGroupMessages()`, `formatMessages()`
- Private functions: camelCase with leading underscore: `_buildVolumeMounts()`, `_validateMount()`
- Constants: SCREAMING_SNAKE_CASE: `MAX_CONCURRENT_CONTAINERS`, `CONTAINER_TIMEOUT`, `POLL_INTERVAL`

**Database:**
- Tables: snake_case plural: `messages`, `chats`, `scheduled_tasks`, `registered_groups`
- Columns: snake_case: `chat_jid`, `sender_name`, `last_message_time`, `is_from_me`

**IPC Files:**
- Format: JSON (no extension, or `.json` suffix)
- Types: `message`, `message_with_buttons`, `schedule_task`, `pause_task`, `todo_create`

**Types and Interfaces:**
- PascalCase: `Channel`, `RegisteredGroup`, `NewMessage`, `ScheduledTask`, `ContainerInput`, `ContainerOutput`
- Convention: Plural for collections: `MountAllowlist`, `AdditionalMount`, `AllowedRoot`

## Where to Add New Code

**New Feature (Message Processing, Agent Logic):**
- Primary code: `container/agent-runner/src/` (runs inside container)
- Test: `container/agent-runner/src/*.test.ts`
- IPC commands: Add handler in `src/ipc.ts` `processTaskIpc()` function
- DB operations: Add methods in `src/db.ts` or `src/todo.ts` as needed

**New Channel (Telegram, Discord, custom platform):**
- Implementation: `src/channels/{platform}.ts`
- Implement `Channel` interface from `src/types.ts`
- Call `registerChannel('{platform}', factory)` at bottom of file
- Add import to `src/channels/index.ts`
- Test: `src/channels/{platform}.test.ts`
- Update `docs/CODEBASE.md` with JID format and capabilities

**New Scheduled Task Type:**
- Add schedule_type to enum in `src/types.ts` (currently: 'cron' | 'interval' | 'once')
- Add parsing logic to `computeNextRun()` in `src/task-scheduler.ts`
- Test: `src/task-scheduler.test.ts`

**New Storage Table or Schema Change:**
- Modify `createSchema()` in `src/db.ts`
- Add migration function if upgrading existing DB
- Add getter/setter in `src/db.ts` near related functions
- Test: `src/db.test.ts`

**New Todo Feature (reminders, subtasks, projects):**
- Implementation: `src/todo.ts` (CRUD functions)
- Database: Schema in `src/db.ts` (todo_items, todo_projects tables)
- IPC handlers: Add type in `src/ipc.ts` `processTaskIpc()`
- Test: Co-located tests or `src/db.test.ts`

**Utilities and Helpers:**
- Shared helpers: `src/` root (e.g., `router.ts`, `logger.ts`, `timezone.ts`)
- Mount validation: `src/mount-security.ts`
- Allowlist/filtering: `src/sender-allowlist.ts`
- Group folder resolution: `src/group-folder.ts`

**Container Build Changes:**
- Dockerfile modifications: `container/Dockerfile`
- Build script: `container/build.sh`
- Agent SDK setup: `container/agent-runner/src/index.ts`
- Skills documentation: `container/skills/{skill}/` (markdown docs for agents)

## Special Directories

**data/ipc/{groupFolder}/:**
- Purpose: Container-to-host communication (transient, recreated per run)
- Generated: Yes (created as needed by container and host)
- Committed: No (gitignored)
- Cleanup: Files deleted after processing; directory persists for next run

**data/sessions/{groupFolder}/.claude/:**
- Purpose: Per-group Claude session state (isolated from other groups)
- Generated: Yes (created by container on first run)
- Committed: No (gitignored, sensitive session data)
- Mounted into container at `/root/.claude/`

**groups/global/:**
- Purpose: Shared agent identity and system instructions
- Generated: No (hand-edited)
- Committed: Yes
- Read by: All containers (main group gets this + project root; non-main get this + own folder)

**logs/**
- Purpose: Pino JSON logs (one per channel or global)
- Generated: Yes (written by logger)
- Committed: No (gitignored)
- Retention: Rotate via external log management (not built-in)

**~/.config/nanoclaw/ (outside project):**
- Purpose: Tamper-proof security configuration
- Generated: No (hand-edited by user)
- Committed: No (stored outside project root)
- Files: `mount-allowlist.json`, `sender-allowlist.json`
- Reason: Not mounted into containers; prevents agents from modifying security policy

---

*Structure analysis: 2026-03-15*
