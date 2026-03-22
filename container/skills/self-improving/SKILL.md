---
name: self-improving
description: Log learnings, errors, and feature requests for continuous improvement across sessions
---

# Self-Improving Agent

You have a persistent logging system so that mistakes, corrections, and feature gaps are captured and carried forward into future sessions.

## Log Files

Log files live at `/workspace/group/learnings/`:
- `LEARNINGS.md` — corrections, knowledge gaps, best practices you discover
- `ERRORS.md` — commands that failed, tool errors, integration issues
- `FEATURE_REQUESTS.md` — things the user asked for that you couldn't do

These files persist between sessions. Read them at the start of a session if you want to recall past learnings.

## When to Log

Log automatically — don't wait to be asked:

- The user corrects you ("Actually, that's wrong", "No, not like that", "That's not what I meant")
- A command or tool fails unexpectedly
- An API or external service breaks
- You discover your knowledge was outdated or incomplete
- You find a significantly better approach than what you were doing
- The user asks for something you can't currently do

## How to Log

### LEARNINGS.md entry

```
## LRN-YYYYMMDD-NNN
- **Area:** tools / config / behaviour / infra
- **Priority:** low / medium / high / critical
- **Status:** pending
- **What I learned:** One clear sentence.
- **Context:** What triggered this learning (e.g. "User corrected date format assumption")
```

### ERRORS.md entry

```
## ERR-YYYYMMDD-NNN
- **Area:** tools / config / behaviour / infra
- **Priority:** low / medium / high / critical
- **Status:** pending
- **Error:** The exact command or action that failed
- **Root Cause:** Why it failed
- **Fix Applied:** What resolved it (or "none yet" if still open)
```

### FEATURE_REQUESTS.md entry

```
## FEAT-YYYYMMDD-NNN
- **Priority:** low / medium / high
- **Status:** pending
- **Requested:** What the user asked for
- **Why not done:** Current limitation (missing tool, access, skill)
```

Increment `NNN` (001, 002, …) within each day. Use `Read` to check the file and find the next available ID before writing.

## Updating an Entry

When you resolve something previously logged, update its `Status` from `pending` to `resolved` and add a `**Resolution:**` line. Use `Edit` to do this in-place.

## Promoting Learnings to Permanent Memory

When a learning is resolved and it's a *behavioural* rule (something that should change how you act forever), promote it to `groups/global/CLAUDE.md` under the `## Learned Behaviours` section:

```bash
# Append to the Learned Behaviours section in global CLAUDE.md
# Use Edit to add a bullet point under that heading
```

Example promoted rule: `- Never use markdown headings in Telegram messages (user corrected 2026-03-21)`

Promote sparingly — only clear, durable rules, not one-off fixes.
