# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**
- kebab-case for file names: `container-runner.ts`, `group-queue.ts`, `sender-allowlist.ts`
- Index files use default names: `src/index.ts`, `src/channels/index.ts`
- Test files: `{module}.test.ts` (co-located with source)
- Channel implementations: `{channel-name}.ts` in `src/channels/`

**Functions:**
- camelCase for all function names
- Private/internal functions prefixed with underscore: `_initTestDatabase()`, `_resetSchedulerLoopForTests()`
- Async functions use standard names with async/await: `processImage()`, `startIpcWatcher()`, `runContainerAgent()`
- Helper functions in tests often lowercase with clear intent: `store()`, `processMessages()`

**Variables:**
- camelCase for all variable names: `lastTimestamp`, `registeredGroups`, `sessions`, `messageLoopRunning`
- Constants (module-level, uppercase): `OUTPUT_START_MARKER`, `OUTPUT_END_MARKER`, `POLL_INTERVAL`
- Immutable config values imported from `src/config.ts` are UPPERCASE: `ASSISTANT_NAME`, `DATA_DIR`, `TIMEZONE`
- Map and Record types use camelCase: `senderBotMap`, `folderIsMain`

**Types/Interfaces:**
- PascalCase for all type definitions: `NewMessage`, `RegisteredGroup`, `ContainerOutput`, `ScheduledTask`
- Generic types follow standard convention: `Record<string, RegisteredGroup>`, `Array<{ ... }>`
- Type union strings use lowercase: `status: 'active' | 'paused' | 'completed'`
- Optional properties marked with `?`: `timeout?: number`, `description?: string`

**Enums/String Unions:**
- String literal unions used instead of enums: `type TodoStatus = 'open' | 'done' | 'cancelled'`
- Type exports with union patterns: `export type TodoAssignee = 'tristan' | 'deltron'`

## Code Style

**Formatting:**
- Tool: Prettier (`npm run format`)
- Config: `.prettierrc` - `{ "singleQuote": true }`
- Single quotes for all strings
- Auto-formatted via pre-commit hook

**Linting:**
- No ESLint config present; formatting enforced via Prettier only
- Rule suppression using eslint comments: `// eslint-disable-next-line @typescript-eslint/no-explicit-any`

**TypeScript Strict Mode:**
- `tsconfig.json` sets `"strict": true` enforcing all strict checks
- Type assertions minimized; `as any` used only when unavoidable (e.g., overriding DNS behavior)
- Imports use full `.js` extension for ESM: `import { logger } from './logger.js'`

## Import Organization

**Order:**
1. Node.js built-in modules: `import fs from 'fs'`, `import path from 'path'`, `import { spawn } from 'child_process'`
2. Third-party packages: `import pino from 'pino'`, `import { Bot } from 'grammy'`, `import Database from 'better-sqlite3'`
3. Local modules (relative imports): `import { getDb } from './db.js'`, `import { logger } from './logger.js'`
4. Type-only imports when needed: `import type { TodoAssignee } from './todo.js'`

**Path Aliases:**
- No path aliases configured; all imports use relative paths with `.js` extension
- Files in `src/` use paths like `./module.js`
- Channels in `src/channels/` use paths like `../config.js`, `../types.js`

**Module Structure:**
- Barrel files: `src/channels/index.ts` imports all channels for side-effect registration
- Named exports preferred: `export function getDb()`, `export const logger = pino(...)`
- Default exports rare; avoided in favor of named exports for clarity

## Error Handling

**Patterns:**
- Try-catch for synchronous operations with logging: `try { ... } catch (err) { logger.error({ err }, 'message') }`
- Promise rejections caught and logged: `catch (err) => { logger.error({ err }, 'Failed to...' ) }`
- Error context passed to logger as object: `{ err: reason }` or `{ err, taskId }`
- Errors propagated via `throw new Error('message')` with descriptive messages
- Fallback/default values on error rather than immediate failure: `JSON.parse(agentTs) ?? {}`, `rows.length === 0 ? {} : parsed`

**Specific Patterns:**
- File I/O: try-catch with fallback or skip on missing files
- IPC file processing: errors logged and loop continues (`setTimeout(processIpcFiles, IPC_POLL_INTERVAL)`)
- Database operations: errors logged with context; state rollback not typically needed for read-only queries
- Container operations: timeout + output parsing with fallback for missing markers

**Global Error Handlers:**
- `src/logger.ts` installs uncaughtException and unhandledRejection handlers
- Both route to `logger.fatal()` or `logger.error()` for visibility
- Process exits on uncaught exception

## Logging

**Framework:** Pino (`src/logger.ts`)

**Config:**
- Level: `process.env.LOG_LEVEL || 'info'`
- Transport: `pino-pretty` with colors enabled
- Initialization: single exported instance `export const logger = pino(...)`

**Patterns:**
- All loggers use centralized instance: `import { logger } from './logger.js'`
- Context passed as first argument (object): `logger.info({ groupCount: 5 }, 'State loaded')`
- Error objects passed as `{ err }`: `logger.error({ err }, 'Failed to load...')`
- Log levels: `.debug()`, `.info()`, `.warn()`, `.error()`, `.fatal()`
- Structured logging with context objects: `logger.info({ count, poolSize }, 'Pool bot initialized')`

**When to Log:**
- Function entry/exit for critical paths: state load, server startup
- Configuration changes: "Pool bot initialized", "Todo project created"
- Errors and exceptions: always logged with context
- Warnings for suspicious conditions: "Corrupted data", "Duplicate start attempt"
- Debug for detailed flow: rarely used in production code

## Comments

**When to Comment:**
- Algorithm explanations: describe the *why* not the *what*
- Security/safety decisions: explain constraints
- Non-obvious state transitions: why a value is set
- TODOs are minimal; complex features documented in JSDoc

**JSDoc/TSDoc:**
- Used for public function APIs and exported types
- Format: `/** description. Multi-line if needed. */`
- Parameter descriptions: rarely used (types are self-documenting with strict TS)
- Return type descriptions: only when non-obvious
- Examples: included when helpful for complex operations

Examples from codebase:
```typescript
/**
 * Store chat metadata only (no message content).
 * Used for all chats to enable group discovery without storing sensitive content.
 */
export function storeChatMetadata(...) { ... }

/**
 * Mount Allowlist - Security configuration for additional mounts
 * This file should be stored at ~/.config/nanoclaw/mount-allowlist.json
 * and is NOT mounted into any container, making it tamper-proof from agents.
 */
export interface MountAllowlist { ... }

/** @internal - for tests only. Creates a fresh in-memory database. */
export function _initTestDatabase(): void { ... }
```

**Inline Comments:**
- Explain non-obvious logic, not every line
- Example: "node-fetch (used by grammy) resolves hostnames via dns.lookup, which may prefer IPv6. In environments where IPv6 is unreachable (e.g. WSL), this causes Telegram connections to hang."

## Function Design

**Size:** Functions range from 10–50 lines typically; helper functions 3–10 lines
- Example: `formatMessages()` ~10 lines, `buildVolumeMounts()` ~40 lines
- No strict limit enforced; complexity and clarity are guides

**Parameters:**
- Positional parameters for 1–2 args: `storeChatMetadata(jid, timestamp)`
- Object parameters for 3+ args or when semantic clarity needed: `new ContainerInput({ prompt, sessionId, groupFolder, ... })`
- Default values via destructuring: `{ recursive: true }`, `overrides.is_from_me ?? false`
- Callback functions as final parameter: `startIpcWatcher(deps)` where deps includes callbacks

**Return Values:**
- Void functions used for side-effects: `export function saveState(): void`
- Functions returning data use explicit types: `function getDb(): Database.Database`
- Promise-based functions: `async function processImage(): Promise<Result | null>`
- Optional returns signaled via union: `string | null`, `Result | undefined`
- Success/error bundled in interface: `interface ContainerOutput { status: 'success' | 'error'; result: string | null; error?: string }`

## Module Design

**Exports:**
- Named exports standard: `export function initDatabase()`, `export const logger = pino(...)`
- Re-exports for backwards compatibility: `export { escapeXml, formatMessages } from './router.js'` in `src/index.ts`
- Type exports: `export interface NewMessage`, `export type OnInboundMessage = (...) => void`

**Barrel Files:**
- `src/channels/index.ts` imports all channels for registration side-effects
- Other modules typically do not use barrel files; explicit imports preferred

**Internal/Private:**
- Test-only exports prefixed with underscore: `_initTestDatabase()`, `_resetSchedulerLoopForTests()`
- No private keyword used; underscore convention signals intent to readers

**Dependency Injection:**
- Heavy use of dependency injection via callback parameters
- Example: `startIpcWatcher(deps: IpcDeps)` where deps contains sendMessage, registeredGroups, etc.
- Keeps modules decoupled; enables mocking in tests

---

*Convention analysis: 2026-03-15*
