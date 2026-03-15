# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- TypeScript 5.7.0 - All application code and build system
- JavaScript - Container entrypoint and runtime

**Secondary:**
- Python - Voice transcription (faster-whisper via `scripts/whisper_transcribe.py`)
- Bash - Container entrypoint and build scripts

## Runtime

**Environment:**
- Node.js 22 (required: >=20) - Primary runtime for orchestrator and agents
- Docker - Container isolation for agent execution

**Package Manager:**
- npm - Package management and dependency resolution
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- @anthropic-ai/claude-agent-sdk - Multi-turn agent execution with MCP support
- typescript 5.7.0 - Type checking and ES2022 target transpilation

**Channel/Messaging:**
- grammy 1.39.3 - Telegram Bot API client with inline keyboard support
- discord.js 14.18.0 - Discord bot client (currently disabled, infrastructure in place)
- @whiskeysockets/baileys 7.0.0-rc.9 - WhatsApp client (optional separate channel fork)
- googleapis 144.0.0 - Google Gmail API client
- google-auth-library - OAuth2 client for Gmail authentication

**Testing:**
- vitest 4.0.18 - Test runner and framework
- @vitest/coverage-v8 4.0.18 - Code coverage reporting

**Build/Dev:**
- tsx 4.19.0 - TypeScript execution for development and scripts
- prettier 3.8.1 - Code formatting
- husky 9.1.7 - Git hooks (prepare hook for pre-commit)

## Key Dependencies

**Critical:**
- better-sqlite3 11.8.1 - Synchronous SQLite for session state, messages, tasks
- @anthropic-ai/claude-agent-sdk - Agent execution with streaming, MCP, session management
- pino 9.6.0 & pino-pretty 13.0.0 - Structured logging with console formatting

**Infrastructure:**
- sharp 0.34.5 - Image resizing and processing (max 1024x1024, JPEG 85% quality)
- zod 4.3.6 - Schema validation for TypeScript
- yaml 2.8.2 - YAML parsing for configuration
- cron-parser 5.5.0 - Cron expression parsing for scheduled tasks
- qrcode & qrcode-terminal 1.5.4 / 0.12.0 - QR code generation for WhatsApp auth

**Container-side (via Dockerfile):**
- node:22-slim - Lightweight Node.js base image
- agent-browser (npm global) - Chromium automation with Playwright
- @anthropic-ai/claude-code (npm global) - Code execution in containers
- chromium - Browser automation backend (installed via apt)
- poppler-utils - PDF processing (`pdf-reader` skill)

## Configuration

**Environment:**
- `.env` file with sensitive credentials (ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN, NOTION_API_KEY, etc.)
- `data/env/env` - Copy of .env injected into containers (must sync manually)
- `.nvmrc` - Node.js version pinned to 22
- `tsconfig.json` - ES2022 target, NodeNext module resolution, strict mode enabled

**Build:**
- `typescript` compiler via `npm run build` → outputs to `dist/`
- Container builds via `./container/build.sh` (rebuilds agent-runner Docker image)
- Post-build: copy `container/agent-runner/src/` to `data/sessions/{group}/agent-runner-src/` for MCP config hot-reload

## Platform Requirements

**Development:**
- Node.js 22+
- npm with package-lock.json
- Docker runtime (Docker Desktop or docker-ce)
- WSL2 on Windows (DNS patched for IPv4-only in `src/channels/telegram.ts`)
- System timezone (used by cron scheduler via `TZ` env var)

**Production:**
- Linux or WSL2 (WSL IPv4 networking workaround in place)
- Docker with volume mount support
- systemd user units for service management

## Container Environment

**Runtime Image:** `nanoclaw-agent:latest` (configurable via `CONTAINER_IMAGE` env)

**Working Directory in Container:** `/workspace/group` (group-specific workspace)

**Mounts (per group):**
- `/workspace/group` - Group folder (writable, contains CLAUDE.md, attachments/)
- `/workspace/global` - Global CLAUDE.md (read-only for non-main)
- `/workspace/extra/{name}` - Additional custom directories (read-only)
- `/workspace/ipc/input/` - IPC message files (JSON poll-based)
- `/workspace/ipc/messages/`, `/workspace/ipc/tasks/` - Output IPC directories
- Project root `/workspace/project` (main group only, read-only; .env shadowed)

**Credential Injection:**
- Credentials injected via HTTP proxy (port 3001 default, `CREDENTIAL_PROXY_PORT` configurable)
- Two auth modes: API key (direct inject) or OAuth (token exchange)
- Containers connect to `ANTHROPIC_BASE_URL` through proxy at gateway IP
- WSL fix: proxy binds to docker0 IP (`172.17.0.1`) if available, else `0.0.0.0`

## Timers & Intervals

- `POLL_INTERVAL`: 2000ms - Main message polling loop
- `SCHEDULER_POLL_INTERVAL`: 60000ms - Scheduled task check
- `IPC_POLL_INTERVAL`: 1000ms - IPC file polling during idle
- `IDLE_TIMEOUT`: 1800000ms (30min default) - Container keep-alive after last result
- `CONTAINER_TIMEOUT`: 1800000ms (30min default) - Max execution time per query
- `MAX_CONCURRENT_CONTAINERS`: 5 (default, configurable)

## Features & Limits

**Image Processing:**
- Maximum dimensions: 1024x1024 (letterbox, no upscaling)
- Format: JPEG with 85% quality
- Storage: `{group}/attachments/` with timestamp+random filename

**Message Chunking:**
- Telegram: 4096 chars per message (split if exceeded)
- Bot pool: Round-robin assignment per sender per group (stable)

**Logging:**
- Structured JSON via pino
- Pretty-printed in development (pino-pretty)
- Levels: debug, info, warn, error

---

*Stack analysis: 2026-03-15*
