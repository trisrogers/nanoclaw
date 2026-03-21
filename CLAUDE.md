# NanoClaw

Personal Claude assistant. See [README.md](README.md) for philosophy and setup. See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for architecture decisions.

## Codebase Map

**[`docs/CODEBASE.md`](docs/CODEBASE.md)** is the authoritative map of how the codebase hangs together — data flows, file responsibilities, DB schema, channel routing, IPC, container mounts, and common gotchas.

- **Read it before making significant code changes** or when debugging unexpected behaviour
- **Update it after every code change** — keep the map accurate so future sessions start with correct context

## Quick Context

Single Node.js process with skill-based channel system. Channels (Telegram, Gmail) self-register at startup. Messages route to Claude Agent SDK running in Docker containers. Each group has isolated filesystem, session, and IPC namespace. Active channels: **Telegram** (primary with optional agent team bot pool), **Gmail** (delivers to Telegram main group). Discord is disabled.

**Agent Teams** (Telegram): Create multi-agent conversations where each team member has a distinct Telegram bot identity. Configure `TELEGRAM_BOT_POOL` env var with comma-separated bot tokens to enable. Team agents use `mcp__nanoclaw__send_message` with `sender` parameter to route messages through their assigned pool bot.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/registry.ts` | Channel registry (self-registration at startup) |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/config.ts` | Trigger pattern, paths, intervals |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `src/todo.ts` | Todo/task CRUD (projects, items, reminders) |
| `src/image.ts` | Image processing and vision (downloads, resizes, stores in group dir) |
| `groups/{name}/CLAUDE.md` | Per-group memory (isolated) |
| `container/skills/agent-browser.md` | Browser automation tool (available to all agents via Bash) |

## Skills

| Skill | When to Use |
|-------|-------------|
| `/setup` | First-time installation, authentication, service configuration |
| `/customize` | Adding channels, integrations, changing behavior |
| `/debug` | Container issues, logs, troubleshooting |
| `/update-nanoclaw` | Bring upstream NanoClaw updates into a customized install |
| `/qodo-pr-resolver` | Fetch and fix Qodo PR review issues interactively or in batch |
| `/get-qodo-rules` | Load org- and repo-level coding rules from Qodo before code tasks |

## Task Management

Use the task list proactively — not just when asked. When working on something worth tracking, create a task. When you finish tracked work, complete it.

```bash
# View open tasks
npx tsx scripts/tasks.ts list

# Create a task
npx tsx scripts/tasks.ts create "Fix login latency" --assignee tristan --project PFR --priority high --due 2026-03-20

# Complete a task
npx tsx scripts/tasks.ts complete TSK-001

# Add a subtask
npx tsx scripts/tasks.ts subtask PFR-002 "Profile DB layer" --assignee deltron
```

Assignee `Tristan` = Tristan's work, `Deltron` = Deltron's work. Use `TSK` project for uncategorised tasks. Infer or create a 3-char project code when work clearly belongs to a project.

## Development

Run commands directly—don't tell the user to run them.

```bash
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
./container/build.sh # Rebuild agent container
```

Service management:
```bash
# macOS (launchd)
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # restart

# Linux (systemd)
systemctl --user start nanoclaw
systemctl --user stop nanoclaw
systemctl --user restart nanoclaw
```

## Troubleshooting

**WhatsApp not connecting after upgrade:** WhatsApp is now a separate channel fork, not bundled in core. Run `/add-whatsapp` (or `git remote add whatsapp https://github.com/qwibitai/nanoclaw-whatsapp.git && git fetch whatsapp main && (git merge whatsapp/main || { git checkout --theirs package-lock.json && git add package-lock.json && git merge --continue; }) && npm run build`) to install it. Existing auth credentials and groups are preserved.

## Container Build Cache

The container buildkit caches the build context aggressively. `--no-cache` alone does NOT invalidate COPY steps — the builder's volume retains stale files. To force a truly clean rebuild, prune the builder then re-run:

```bash
docker builder prune -f
docker build --no-cache -t nanoclaw-agent:latest ./container
```

**Symptom:** Source code change has no effect — container still crashes with the old error even after a rebuild. The entrypoint compiles TypeScript at container startup (`npx tsc --outDir /tmp/dist`), so the compiled `.js` in the image must be fresh.

## Agent Runner: ESM and `__dirname`

`container/agent-runner/src/index.ts` is an ES Module. `__dirname` is not a global in ESM — it must be declared at **module scope** using:

```ts
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

If this is declared inside a function (e.g. `main()`), any other function that references `__dirname` will throw `__dirname is not defined` at runtime. Keep it at the top of the file, outside all functions.
