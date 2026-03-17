# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Runner:**
- Vitest (latest) - config: `vitest.config.ts`
- TypeScript first-class support; no transpilation friction

**Assertion Library:**
- Vitest built-in expect API

**Run Commands:**
```bash
npm test                # Run all tests (vitest run)
npm run test:watch     # Watch mode for development
npm run coverage       # Run with coverage report (@vitest/coverage-v8)
```

## Test File Organization

**Location:**
- Co-located with source: `src/module.test.ts` beside `src/module.ts`
- Pattern: find source file location, append `.test.ts`

**Naming:**
- Format: `{source-module}.test.ts`
- Examples: `db.test.ts`, `container-runner.test.ts`, `group-queue.test.ts`, `image.test.ts`

**Count:** 19 test files across codebase (as of 2026-03-15)

**Discovery:**
- Config in `vitest.config.ts`: `include: ['src/**/*.test.ts', 'setup/**/*.test.ts']`

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Setup helpers
function setupTest() { ... }

// Main suite
describe('feature name', () => {
  let state: object;

  beforeEach(() => {
    state = { ... };
  });

  afterEach(() => {
    // cleanup
  });

  // Grouped related tests
  describe('sub-feature', () => {
    it('does the thing', () => {
      expect(result).toBe(expected);
    });
  });
});
```

**Patterns:**

1. **Setup/Teardown:**
   - `beforeEach()` initializes test database or mocks: `vi.useFakeTimers()`, `_initTestDatabase()`
   - `afterEach()` cleans up: `vi.useRealTimers()`, clear mocks
   - No before/afterAll patterns used in current tests

2. **Assertion Style:**
   - Fluent expect chains: `expect(value).toBe(expected)`, `expect(array).toContain(item)`
   - Custom matchers not used; built-in set sufficient
   - Negation: `expect(x).not.toBeNull()`, `expect(groups).not.toContain(item)`
   - Multiple assertions per test common: checks result + side effects
   - Example:
     ```typescript
     it('stores a message and retrieves it', () => {
       store({ id: 'msg-1', chat_jid: 'group@g.us', ... });
       const messages = getMessagesSince('group@g.us', timestamp);
       expect(messages).toHaveLength(1);
       expect(messages[0].content).toBe('hello world');
     });
     ```

3. **Test Naming:**
   - Descriptive, human-readable: `'respects global concurrency limit'`, `'returns only groups, excludes DMs'`
   - Verbs describe behavior: returns, stores, ignores, respects, marks, orders
   - Context in nested describes: `describe('JID ownership patterns', () => { it('WhatsApp group JID: ...') })`

## Mocking

**Framework:** Vitest `vi` mock utilities

**Mock Patterns:**

1. **Module Mocks (vi.mock):**
   ```typescript
   vi.mock('./config.js', () => ({
     DATA_DIR: '/tmp/nanoclaw-test-data',
     MAX_CONCURRENT_CONTAINERS: 2,
   }));
   ```
   - Declared before imports
   - Return object with exports to stub
   - Used for config, logger, fs operations

2. **Function Mocks (vi.fn):**
   ```typescript
   const processMessages = vi.fn(async (groupJid: string) => {
     // mock behavior
     return true;
   });

   queue.setProcessMessagesFn(processMessages);
   expect(processMessages).toHaveBeenCalledWith('group1@g.us');
   ```
   - Wrap actual function or provide implementation
   - Track call count/arguments with `toHaveBeenCalledWith()`
   - Return implementation for side-effect checks

3. **Async Mocking:**
   ```typescript
   vi.mock('fs', async () => {
     const actual = await vi.importActual<typeof import('fs')>('fs');
     return {
       ...actual,
       default: { ...actual, mkdirSync: vi.fn(), ... },
     };
   });
   ```
   - Import actual module via `vi.importActual()`
   - Spread and override specific functions
   - Preserves real implementations you don't mock

4. **Stream/EventEmitter Mocks:**
   ```typescript
   function createFakeProcess() {
     const proc = new EventEmitter() as EventEmitter & {
       stdin: PassThrough;
       stdout: PassThrough;
       pid: number;
     };
     proc.stdin = new PassThrough();
     proc.stdout = new PassThrough();
     proc.kill = vi.fn();
     proc.pid = 12345;
     return proc;
   }
   ```
   - Use Node.js PassThrough streams to simulate I/O
   - Extend EventEmitter for process events
   - Emit events to simulate behavior

**What to Mock:**
- File system operations (fs): because tests must not touch disk
- Config modules: to control test environments
- Logger: to suppress output and verify logging
- External network calls: API mocks not shown in tests (likely stubbed via config)
- Child processes: spawn/exec mocked to avoid actual container interaction

**What NOT to Mock:**
- Core database functions: `storeMessage()`, `getMessagesSince()` use actual in-memory SQLite
- Business logic: test real implementation, not mocked behavior
- Built-in Node modules that don't do I/O: crypto, zlib, etc.

## Fixtures and Factories

**Test Data:**
```typescript
// Inline helper function in test
function store(overrides: {
  id: string;
  chat_jid: string;
  sender: string;
  sender_name: string;
  content: string;
  timestamp: string;
  is_from_me?: boolean;
}) {
  storeMessage({
    id: overrides.id,
    chat_jid: overrides.chat_jid,
    sender: overrides.sender,
    sender_name: overrides.sender_name,
    content: overrides.content,
    timestamp: overrides.timestamp,
    is_from_me: overrides.is_from_me ?? false,
  });
}

// Usage
store({ id: 'msg-1', chat_jid: 'group@g.us', ... });
```

- Factories created as inline helper functions in test files
- No shared fixture files (each test module self-contained)
- Overrides pattern: pass only properties you care about; rest use defaults
- Allows creating realistic test data with minimal boilerplate

**Const Test Data:**
```typescript
const testGroup: RegisteredGroup = {
  name: 'Test Group',
  folder: 'test-group',
  trigger: '@Andy',
  added_at: new Date().toISOString(),
};

const testInput = {
  prompt: 'Hello',
  sessionId: 'sess-123',
  groupFolder: 'test-group',
  chatJid: 'chat@g.us',
  isMain: false,
};
```

- Reused across multiple test cases
- Defined near describe() block
- Immutable; tests don't modify

**Location:**
- Fixtures live inline in test file (no separate fixture directory)
- Makes tests self-contained and discoverable

## Coverage

**Requirements:** Not enforced (no coverage threshold in config)

**View Coverage:**
```bash
npm test -- --coverage
```

**Current Status:**
- Coverage reporting available via `@vitest/coverage-v8`
- No minimum threshold enforced; coverage not gated in CI (if applicable)

## Test Types

**Unit Tests:**
- Scope: single module or function
- Approach: mock dependencies, test behavior
- Example: `db.test.ts` tests database functions with in-memory SQLite
- Example: `image.test.ts` mocks fs and sharp, tests image processing logic

**Integration Tests:**
- Scope: multiple modules working together
- Approach: real implementations where possible, selective mocks
- Example: `container-runner.test.ts` mocks child_process but uses real config module
- Example: `group-queue.test.ts` mocks config but tests queue concurrency semantics

**E2E Tests:**
- Framework: Not used
- Rationale: Full end-to-end testing (Telegram→agent→response) done manually or via staging
- Integration tests cover most API surface

## Common Patterns

**Async Testing:**

```typescript
// Using async/await
it('processes tasks concurrently', async () => {
  queue.setProcessMessagesFn(processMessages);
  queue.enqueueMessageCheck('group1@g.us');

  // Let async operations complete
  await vi.advanceTimersByTimeAsync(200);

  expect(processMessages).toHaveBeenCalled();
});
```

- Mark test function as `async`
- Use `await` for async operations
- Use `vi.advanceTimersByTimeAsync()` with fake timers for timeout-based logic
- `vi.useFakeTimers()` in beforeEach, `vi.useRealTimers()` in afterEach

**Error Testing:**

```typescript
it('pauses due tasks with invalid group folders', async () => {
  createTask({
    id: 'task-invalid-folder',
    group_folder: '../../outside',  // invalid path
    chat_jid: 'bad@g.us',
    prompt: 'run',
    // ... other fields
  });

  // Run scheduler
  startSchedulerLoop({ ... });
  await vi.advanceTimersByTimeAsync(10);

  // Verify error handling: task should be paused
  const task = getTaskById('task-invalid-folder');
  expect(task?.status).toBe('paused');
});
```

- Arrange conditions that trigger errors
- Act on the code
- Assert defensive behavior (pausing, logging, recovery)
- Prefer testing error handling over mocking exceptions

**State Verification:**

```typescript
it('only runs one container per group at a time', async () => {
  let concurrentCount = 0;
  let maxConcurrent = 0;

  const processMessages = vi.fn(async (groupJid: string) => {
    concurrentCount++;
    maxConcurrent = Math.max(maxConcurrent, concurrentCount);
    await new Promise((resolve) => setTimeout(resolve, 100));
    concurrentCount--;
    return true;
  });

  // ... enqueue, advance timers ...
  expect(maxConcurrent).toBe(1);
});
```

- Capture state during mock execution (counters, timestamps)
- Verify post-conditions
- Used for concurrency and race condition testing

**Database Testing:**

```typescript
beforeEach(() => {
  _initTestDatabase();  // Fresh in-memory SQLite
});

it('stores and retrieves messages', () => {
  storeChatMetadata('group@g.us', timestamp);
  store({ id: 'msg-1', chat_jid: 'group@g.us', ... });

  const messages = getMessagesSince('group@g.us', timestamp);
  expect(messages).toHaveLength(1);
});
```

- Use `_initTestDatabase()` for fresh schema each test
- No teardown needed (in-memory DB discarded)
- Tests verify SQL semantics and data integrity

## Test Data Patterns

**Timestamp Handling:**
- Use ISO strings: `'2024-01-01T00:00:00.000Z'`, `new Date().toISOString()`
- Time comparisons: `Date.now() - 60_000` for "time in past"

**JID (Jabber ID) Formats:**
- WhatsApp groups: `'group@g.us'`
- WhatsApp DMs: `'123@s.whatsapp.net'`
- Telegram/Discord: actual JIDs as strings
- Use realistic formats in tests (impacts routing logic)

**Task ID Format:**
- Format: `'TSK-001'`, `'PFR-002'` (project code + zero-padded sequence)
- Tests use simpler IDs: `'task-invalid-folder'`, `'drift-test'`
- Still follow task_id interface expectations

---

*Testing analysis: 2026-03-15*
