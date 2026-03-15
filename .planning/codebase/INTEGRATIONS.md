# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**Messaging Channels:**
- Telegram - Primary channel via Telegram Bot API (grammy)
  - SDK: `grammy` 1.39.3
  - Auth: Bot token via `TELEGRAM_BOT_TOKEN` env var
  - Features: Inline keyboards, voice transcription, photo/media download
  - Bot Pool: Optional multiple bot identities via `TELEGRAM_BOT_POOL` (comma-separated tokens)
  - Pool behavior: Round-robin assignment per sender per group, stable mapping

- Discord - Secondary channel via Discord.js (currently infrastructure-ready, disabled)
  - SDK: `discord.js` 14.18.0
  - Auth: Bot token via `DISCORD_BOT_TOKEN` env var
  - Status: Channel registered at startup but not actively used

- WhatsApp - Optional separate channel fork (not bundled in core)
  - SDK: `@whiskeysockets/baileys` 7.0.0-rc.9
  - Auth: Phone + QR code via `npm run auth`
  - Install: `git remote add whatsapp ...` (separate repository)
  - Storage: Credentials in separate config

- Gmail - Email-to-chat forwarding
  - SDK: `googleapis` 144.0.0 with OAuth2
  - Credentials: `~/.gmail-mcp/gcp-oauth.keys.json` + `credentials.json`
  - MCP Server: `@gongrzhe/server-gmail-autoauth-mcp`
  - Poll interval: 60000ms (configurable)
  - Behavior: Polls for new messages, forwards to registered main group

## Data Storage

**Databases:**
- SQLite (better-sqlite3 11.8.1)
  - Location: `store/nanoclaw.db` (default, configurable via `STORE_DIR`)
  - Synchronous client (blocking) for state consistency
  - Tables: `chats`, `messages`, `scheduled_tasks`, `task_run_logs`, `router_state`, `sessions`
  - Used by: Message routing, session tracking, task scheduling, chat metadata

**File Storage:**
- Local filesystem only
  - Group folders: `groups/{name}/` (per-group isolated)
  - Global memory: `groups/global/CLAUDE.md`
  - Attachments: `groups/{name}/attachments/` (images)
  - Conversations archive: `groups/{name}/conversations/` (markdown transcripts)
  - Container sessions: `data/sessions/{group}/` (isolated per group)

**Caching:**
- In-memory caches
  - `sessions`: Recent session IDs per group
  - `registeredGroups`: Channel registrations (reloaded on startup)
  - `lastAgentTimestamp`: Per-group agent query tracking
  - IPC message queues (files, not memory-cached)

## Authentication & Identity

**Auth Provider:**
- Custom multi-provider system (no single provider)
  - Telegram: Bot tokens (no user auth required)
  - Gmail: OAuth2 (3-legged, credentials stored in user home dir)
  - WhatsApp: QR code + persistent session
  - Discord: Bot token

**Claude Authentication:**
- Two modes (configured via credential proxy):
  - API key: Direct `ANTHROPIC_API_KEY` (x-api-key header injection)
  - OAuth: `CLAUDE_CODE_OAUTH_TOKEN` (bearer token exchange)
- Credential Proxy (src/credential-proxy.ts):
  - Runs on port 3001 (configurable: `CREDENTIAL_PROXY_PORT`)
  - Containers connect via `ANTHROPIC_BASE_URL`
  - Injects credentials on-the-fly (containers never see secrets)
  - WSL workaround: binds to docker0 IP if available

**Session Management:**
- Claude Agent SDK handles per-group session persistence
  - Session file: `data/sessions/{group}/agent-runner-src/transcript.jsonl`
  - Session ID stored in SQLite sessions table
  - Compaction: Pre-compact hook archives conversations to markdown

## Monitoring & Observability

**Error Tracking:**
- None (custom error handling via logging)

**Logs:**
- pino structured logging (JSON in production, pretty-printed in dev)
- Log level: Configurable (info default)
- Output: stdout (systemd/docker capture)
- Modules: Agent output, channel events, container lifecycle, IPC processing

## CI/CD & Deployment

**Hosting:**
- Self-hosted on Linux/WSL2
- systemd user service: `com.nanoclaw` (systemctl --user)
- Service management: systemctl start/stop/restart

**CI Pipeline:**
- None bundled (manual rebuild via `npm run build`)
- Container rebuild: `./container/build.sh`
- Buildkit cache pruning available (use before full rebuild)

## Environment Configuration

**Required env vars (host):**
- `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` - Claude authentication
- `TELEGRAM_BOT_TOKEN` - Telegram bot authorization
- `ASSISTANT_NAME` - Bot identity (default: "Andy")
- `TIMEZONE` - For cron scheduling (system timezone if unset)

**Optional env vars:**
- `TELEGRAM_BOT_POOL` - Comma-separated bot tokens for agent teams
- `ASSISTANT_HAS_OWN_NUMBER` - WhatsApp feature flag
- `DISCORD_BOT_TOKEN` - Discord (if enabling channel)
- `NOTION_API_KEY` - Notion MCP integration
- `CONTAINER_IMAGE` - Docker image name (default: nanoclaw-agent:latest)
- `CONTAINER_TIMEOUT` - Query timeout in ms (default: 1800000)
- `MAX_CONCURRENT_CONTAINERS` - Parallel container limit (default: 5)
- `CREDENTIAL_PROXY_PORT` - Proxy listen port (default: 3001)
- `IDLE_TIMEOUT` - Container keep-alive duration (default: 1800000)
- `ANTHROPIC_BASE_URL` - Override API endpoint (default: https://api.anthropic.com)

**Secrets location:**
- `.env` file at project root (git-ignored, contains all sensitive values)
- `~/.gmail-mcp/` - Gmail OAuth credentials (separate from project)
- `~/.config/nanoclaw/` - Mount allowlist & sender allowlist (security isolation)

## MCP (Model Context Protocol) Servers

**Configured MCP servers (container-side, in agent-runner):**

**nanoclaw** (internal)
- Command: `node {ipc-mcp-stdio.js}`
- Environment: NANOCLAW_CHAT_JID, NANOCLAW_GROUP_FOLDER, NANOCLAW_IS_MAIN
- Tools: mcp__nanoclaw__send_message, mcp__nanoclaw__store_ipc_file
- Features: Telegram inline buttons, group-to-group messaging, file IPC

**gmail** (MCP server via npx)
- Command: `npx -y @gongrzhe/server-gmail-autoauth-mcp`
- Environment: None (auto-configured)
- Tools: Gmail query, send, drafts
- Condition: Always enabled

**notion** (optional MCP server via npx)
- Command: `npx -y @notionhq/notion-mcp-server`
- Environment: `OPENAPI_MCP_HEADERS` (Bearer token via NOTION_API_KEY)
- Tools: Notion query, create, update
- Condition: Only if `NOTION_API_KEY` env var present
- Note: Uses Internal Integration token (ntn_...), not OAuth

## Webhooks & Callbacks

**Incoming:**
- None (all channels poll or use long-lived connections)

**Outgoing:**
- IPC-based (file polling, not HTTP webhooks)
- Message sending: Router → Telegram/Discord/Gmail APIs
- Scheduled tasks: Query → Agent SDK → results written to IPC

## Image Processing & Vision

**Image Handling:**
- Download: From Telegram/WhatsApp message media
- Processing: `sharp` library (resize to 1024x1024 max, JPEG 85%)
- Storage: `{group}/attachments/{timestamp}-{random}.jpg`
- Vision: Images sent to Claude as base64 multimodal content blocks
- Reference syntax: `[Image: attachments/{filename}]` in message content

## Credential Proxy Architecture

**Purpose:** Isolate secrets from containers

**Flow:**
1. Host process reads `.env` (secrets exposed in memory only)
2. Credential proxy starts on 3001 (binds to docker0 on WSL for container access)
3. Container connects to proxy via `ANTHROPIC_BASE_URL`
4. Proxy intercepts requests, injects credentials, forwards upstream

**Security:**
- Containers never mount `.env` (shadowed with `/dev/null`)
- Containers only see mount allowlist + sender allowlist (outside project)
- Credentials passed only on-wire, never stored in container
- Project root mounted read-only to prevent code tampering

---

*Integration audit: 2026-03-15*
