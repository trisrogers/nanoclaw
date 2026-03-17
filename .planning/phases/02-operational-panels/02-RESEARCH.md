# Phase 2: Operational Panels - Research

**Researched:** 2026-03-16
**Domain:** React SPA panels, Express REST endpoints, WebSocket chat, Pino log parsing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Chat panel: messenger bubble style, user right (blue), Deltron left (dark gray), Enter to send, Shift+Enter for newlines, animated three-dot typing indicator while processing, session history in component state only (clears on page reload)
- Overview panel: two-column grid for stat cards, five cards total (channels connected, active containers, IPC queue depth, todos due today, last error), groups/channels table below stats grid, auto-refresh every 10 seconds
- Log viewer: auto-scroll to bottom only if already at bottom, level filter is client-side (backend always returns all 200 lines), monospace font with timestamp + colour-coded level badge (error=red, warn=yellow, info=gray, debug=dim) + message, Pino JSON fields collapsed into message, auto-refresh every 5 seconds
- Destructive actions: inline confirm pattern (button transforms to "Confirm?" + "Cancel" pair in place — no modal)
- All new components follow `gray-950/900/800` dark theme established in Phase 1

### Claude's Discretion
- Container status panel layout (table vs cards) — choose based on what fits the dark Tailwind theme best
- Exact spacing, typography, icon choices (lucide-react is available)
- Error state and empty state handling within panels

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OVER-01 | User can view status overview panel: channels connected, active containers, pending tasks, last error | New `/api/stats` endpoint; in-memory state exposed via module-level getter; five stat cards in two-column grid |
| OVER-02 | Status overview refreshes every 10 seconds | `setInterval` in React `useEffect`; abort controller on cleanup |
| CHAT-01 | User can send messages to Deltron using JID `web:dashboard` | Register `web:dashboard` group on server startup; `storeMessage` + `queue.enqueueMessageCheck`; WS message handler |
| CHAT-02 | User receives Deltron responses in real-time via WebSocket | WS `send()` called from `onOutput` callback intercepted for `web:dashboard`; existing `wss` in `server.ts` |
| CHAT-03 | Dashboard chat isolated from Telegram and other channel sessions | `web:dashboard` JID uses separate folder `dashboard`; never routed through channel registry |
| CHAT-04 | Typing/thinking indicator while Deltron is processing | WS typed message `{type:"typing",value:true/false}` sent before/after agent run; three-dot animated CSS bubble in React |
| OPS-01 | Container status per group (running / idle / stopped) with elapsed time | `GroupQueue` internal `groups` Map exposed via new getter; new `/api/containers` endpoint |
| OPS-02 | Clear group session from dashboard (confirmation required) | New `POST /api/containers/:folder/clear` calls existing `clearSession()` + removes from in-memory `sessions` |
| OPS-03 | Restart group container from dashboard (confirmation required) | New `POST /api/containers/:folder/restart` calls `queue.closeStdin(jid)` to signal container shutdown |
| OPS-04 | Log viewer: last 200 lines from Pino log file with level filtering | New `/api/logs` reads `logs/nanoclaw.log`, tails last 200 lines, strips ANSI, parses pino-pretty format |
| OPS-05 | Log viewer auto-refreshes every 5 seconds | `setInterval` in React `useEffect` |
| GRP-01 | View all registered groups with JID, folder, isMain, requiresTrigger | `/api/groups` already exists — no changes needed |
| GRP-02 | View all channels with connection status | New `/api/channels` endpoint reading in-memory `channels` array via getter exported from `index.ts` |
</phase_requirements>

---

## Summary

Phase 2 delivers five interactive panels on top of the Phase 1 scaffold: Overview (stat cards + groups table), Chat (WebSocket messenger), Containers (per-group status + actions), Logs (tailed log viewer), and Groups (channel list). The frontend is a React SPA using Tailwind v4 with lucide-react icons. The backend is Express with `ws` for WebSocket, all running in-process with NanoClaw.

The most complex integration is the dashboard chat channel. NanoClaw's message loop and GroupQueue are tightly coupled to the `Channel` abstraction and `registeredGroups` map. The dashboard channel bypasses the real channel registry by injecting into the orchestrator directly — the `web:dashboard` group must be registered in `registeredGroups` at startup, and the WebSocket handler must call `storeMessage` then `queue.enqueueMessageCheck` to trigger the agent pipeline. Outbound responses are captured by adding a WS-aware `onOutput` override in the `processGroupMessages` path.

The second significant finding is that `logs/nanoclaw.log` is written by `pino-pretty` with ANSI colour codes, NOT raw JSON. The `/api/logs` endpoint must strip ANSI escapes before parsing. The log file path is `/home/tris/nanoclaw/logs/nanoclaw.log` (confirmed from systemd unit `StandardOutput=append:...`).

**Primary recommendation:** Build the four new REST routes and the WebSocket chat handler as separate route/module files in `src/dashboard/routes/`, then wire them into `server.ts`. Keep `index.ts` changes minimal — add one getter per in-memory object that panels need to read (`getChannels`, `getSessions`, `getQueueState`).

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^5.2.1 | REST API routes | Already the server framework |
| ws | ^8.19.0 | WebSocket server | Already installed, `wss` in `server.ts` |
| react | ^19.2.4 | SPA panels | Already the frontend framework |
| tailwindcss | ^4.2.1 | Utility CSS | Already installed, dark theme established |
| lucide-react | ^0.577.0 | Icons | Already installed per CONTEXT.md |
| pino | ^9.6.0 | Log source | Already the logger; log file is what `/api/logs` reads |
| better-sqlite3 | ^11.8.1 | DB for stats | Already in use |
| vitest | ^4.0.18 | Tests | Already configured |

### No New Dependencies Required

All Phase 2 functionality is achievable with the existing installed packages. The frontend needs no new libraries for:
- WebSocket client: native browser `WebSocket` API
- Polling: native `setInterval` + `fetch`
- Typing indicator: CSS animation (Tailwind `animate-bounce` or custom keyframe)
- Log line ANSI stripping: small utility function (regex, no library needed)

**Installation:** No new `npm install` needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/dashboard/
├── server.ts              # existing — wire new routes + expose getters
├── routes/
│   ├── groups.ts          # existing — /api/groups (no change)
│   ├── stats.ts           # new — /api/stats
│   ├── channels.ts        # new — /api/channels
│   ├── containers.ts      # new — /api/containers, POST clear/restart
│   └── logs.ts            # new — /api/logs
└── chat-handler.ts        # new — WebSocket message handler for web:dashboard

dashboard/src/
├── App.tsx                # existing — replace placeholder with panel router
├── components/
│   ├── OverviewPanel.tsx  # new — stats grid + groups table
│   ├── ChatPanel.tsx      # new — messenger bubble chat
│   ├── ContainersPanel.tsx # new — per-group container status + actions
│   ├── LogsPanel.tsx      # new — tailed log viewer
│   └── GroupsPanel.tsx    # new — registered groups table
```

### Pattern 1: State Exposure via Module Getters

`src/index.ts` holds `channels`, `sessions`, and `registeredGroups` as module-level variables. The dashboard server is started from `main()` in the same module, so passing getters at startup time is the cleanest approach.

```typescript
// In src/index.ts — add near existing registerGroup helper
export function getChannels(): Channel[] {
  return channels;
}

export function getSessionsMap(): Record<string, string> {
  return sessions;
}
```

Then `startDashboardServer` receives these as constructor dependencies:

```typescript
// src/dashboard/server.ts
export function startDashboardServer(
  port: number,
  bindHost: string,
  deps: DashboardDeps,  // new
): http.Server
```

Where `DashboardDeps` carries all the getter functions routes need.

### Pattern 2: REST Route Files with Injected Deps

Each route file exports a factory that takes deps and returns a Router. This avoids module-level singletons in route files.

```typescript
// src/dashboard/routes/stats.ts
import { Router } from 'express';

export interface StatsDeps {
  getChannels: () => Channel[];
  getQueueState: () => Map<string, GroupState>;
  getIpcQueueDepth: () => number;
  getDueTodayCount: () => number;
  getLastError: () => string | null;
}

export function statsRouter(deps: StatsDeps): Router {
  const router = Router();
  router.get('/stats', (_req, res) => {
    res.json({
      channelsConnected: deps.getChannels().filter(ch => ch.isConnected()).length,
      activeContainers: [...deps.getQueueState().values()].filter(s => s.active).length,
      ipcQueueDepth: deps.getIpcQueueDepth(),
      todosDueToday: deps.getDueTodayCount(),
      lastError: deps.getLastError(),
    });
  });
  return router;
}
```

### Pattern 3: Dashboard Chat Channel Registration

The `web:dashboard` group must be registered in `registeredGroups` at startup so the message loop recognises its JID. It must NOT be added to the `channels` array (it has no real channel connection). The WebSocket handler calls `storeMessage` directly, then triggers the queue.

Key insight from `processGroupMessages`: the function calls `findChannel(channels, chatJid)` which will fail for `web:dashboard` since no channel owns that JID. The fix: create a minimal `WebDashboardChannel` that implements just enough of the `Channel` interface (including `ownsJid` returning true for `web:dashboard`, `sendMessage` that pushes to connected WebSocket clients, and `setTyping` that sends `{type:"typing"}` WS frames). Register it in the `channels` array.

```typescript
// src/channels/web-dashboard.ts
export class WebDashboardChannel implements Channel {
  name = 'web-dashboard';
  private wsClients = new Set<WebSocket>();

  ownsJid(jid: string): boolean {
    return jid === 'web:dashboard';
  }

  async sendMessage(_jid: string, text: string): Promise<void> {
    const frame = JSON.stringify({ type: 'message', text });
    for (const ws of this.wsClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    }
  }

  async setTyping(_jid: string, isTyping: boolean): Promise<void> {
    const frame = JSON.stringify({ type: 'typing', value: isTyping });
    for (const ws of this.wsClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    }
  }

  addClient(ws: WebSocket): void { this.wsClients.add(ws); }
  removeClient(ws: WebSocket): void { this.wsClients.delete(ws); }

  isConnected(): boolean { return true; }
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
```

The `WebDashboardChannel` instance is created once and shared between `index.ts` (added to `channels[]`) and `server.ts` (passed to `wss.on('connection')` handler via deps).

### Pattern 4: Log File Reading

The log file is pino-pretty formatted with ANSI colour codes (confirmed from `logs/nanoclaw.log`). The endpoint must:
1. Read the last 200 lines of `logs/nanoclaw.log` using `fs.readFileSync` + `split('\n')` (file is small enough)
2. Strip ANSI escape sequences: `/\x1B\[[0-9;]*m/g`
3. Parse pino-pretty format: `[HH:MM:SS.mmm] LEVEL (pid): message\n    key: value`
4. Return structured objects `{ timestamp, level, message, raw }`

The pino-pretty line format is: `[21:53:14.834] INFO (68834): Database initialized`
Fields on subsequent indented lines are key-value pairs belonging to the preceding entry.

**Alternative if parsing is too fragile:** return `raw` string lines with ANSI stripped, let the frontend render them monospace. The CONTEXT.md requirement is for monospace + colour-coded level badge — the badge can be inferred from the LEVEL token in the line.

```typescript
// src/dashboard/routes/logs.ts
const ANSI_STRIP = /\x1B\[[0-9;]*m/g;
const PINO_PRETTY_LINE = /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\] (\w+) \(\d+\): (.+)/;

function tailFile(filePath: string, lineCount: number): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').filter(Boolean).slice(-lineCount);
  } catch {
    return [];
  }
}
```

### Pattern 5: IPC Queue Depth

The IPC queue depth (for the stats card) = number of pending `.json` files in `data/ipc/*/messages/` directories. The IPC watcher polls these directories and deletes files after processing. Count files across all group IPC message dirs:

```typescript
function getIpcQueueDepth(): number {
  const ipcBase = path.join(DATA_DIR, 'ipc');
  try {
    let count = 0;
    for (const groupDir of fs.readdirSync(ipcBase)) {
      const msgDir = path.join(ipcBase, groupDir, 'messages');
      try {
        count += fs.readdirSync(msgDir).filter(f => f.endsWith('.json')).length;
      } catch { /* dir may not exist */ }
    }
    return count;
  } catch { return 0; }
}
```

### Pattern 6: Container Status

The `GroupQueue.groups` Map is private. Two options:
- Add a public `getState()` method to `GroupQueue` returning a snapshot
- Export a read-only view of the map via a getter

The cleanest approach: add a `getSnapshot()` method to `GroupQueue` that returns an array of `{ jid, active, containerName, startedAt }` entries. The `startedAt` timestamp needs to be tracked — add it to `GroupState` when `active` is set to `true`.

```typescript
// Add to GroupState interface in group-queue.ts
startedAt: number | null;

// Add to GroupQueue class
getSnapshot(): ContainerSnapshot[] {
  return [...this.groups.entries()].map(([jid, state]) => ({
    jid,
    active: state.active,
    containerName: state.containerName,
    elapsedMs: state.startedAt ? Date.now() - state.startedAt : null,
    groupFolder: state.groupFolder,
  }));
}
```

### Pattern 7: Clear Session + Restart Actions

Both POST endpoints need access to in-memory state in `index.ts`:

- **Clear session** (`POST /api/containers/:folder/clear`): calls `clearSession(folder)` from `db.ts` + deletes from `sessions` map + calls `queue.closeStdin(jid)`. Needs `folder→jid` reverse lookup via `registeredGroups`.
- **Restart container** (`POST /api/containers/:folder/restart`): calls `queue.closeStdin(jid)` which signals the idle timer to wind down the container; the next incoming message will spin up a fresh container. This is the correct behaviour — there is no "kill container immediately" button, just "signal it to stop".

### Anti-Patterns to Avoid

- **Importing `index.ts` from route files**: creates circular import (index imports server, server imports index). Use dependency injection via `deps` parameter instead.
- **Reading GroupQueue.groups directly from routes**: the `groups` Map is private — add a `getSnapshot()` method.
- **Parsing raw ANSI log lines as JSON**: the logger uses `pino-pretty` transport which outputs human-readable text, not JSON. Parse as text, not JSON.
- **Creating a new `web:dashboard` group in the DB**: the group exists only in memory (`registeredGroups`) — it must NOT be persisted to the `registered_groups` table or it will appear in the Groups panel and confuse users.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket client (frontend) | Custom EventEmitter wrapper | Native browser `WebSocket` | No dependencies needed; `onmessage`, `onopen`, `onclose` are sufficient |
| Typing animation | Custom JS timer | Tailwind `animate-bounce` + three spans | CSS-only, no JS state needed |
| Log line tailing | Stream/tail library | `fs.readFileSync` + `split('\n').slice(-200)` | Log file is small (under 10MB); synchronous read is fine for polling endpoint |
| ANSI stripping | `strip-ansi` npm package | Single regex `/\x1B\[[0-9;]*m/g` | Avoids dependency; covers pino-pretty output patterns |
| Polling infrastructure | Custom polling hook | `useEffect` + `setInterval` + `AbortController` | Standard React pattern, no library needed |
| Confirm dialog | Modal component library | Inline button state toggle | Locked decision — no modals |

---

## Common Pitfalls

### Pitfall 1: Circular Import Between index.ts and server.ts

**What goes wrong:** `server.ts` is imported by `index.ts`. If route files inside `src/dashboard/routes/` import from `src/index.ts` to access `channels` or `sessions`, TypeScript/Node will resolve a circular dependency at runtime causing `undefined` values.

**Why it happens:** `index.ts` calls `startDashboardServer()`; if routes import from `index.ts`, the import circle closes.

**How to avoid:** All in-memory state access from route handlers must go through constructor-injected dependency functions. `startDashboardServer` receives a `deps` object containing all necessary getters.

**Warning signs:** Route handler sees `undefined` where it expects an array; TypeScript compiles fine but runtime crashes.

### Pitfall 2: web:dashboard JID Missing from registeredGroups

**What goes wrong:** The WebSocket handler stores the message and calls `queue.enqueueMessageCheck('web:dashboard')`, but `processGroupMessages` exits early at `if (!group) return true` because `registeredGroups['web:dashboard']` is undefined.

**Why it happens:** The group was not registered at startup, or was registered only in the DB (which is read at startup into memory but the dashboard group should not be in the DB).

**How to avoid:** Register the group directly into the in-memory `registeredGroups` map in `main()` BEFORE starting the message loop, without calling `setRegisteredGroup` (which would persist it).

```typescript
// In main(), after loadState():
registeredGroups['web:dashboard'] = {
  name: 'Dashboard',
  folder: 'dashboard',
  trigger: '',
  added_at: new Date().toISOString(),
  isMain: false,
  requiresTrigger: false,
};
```

**Warning signs:** Messages sent from the chat panel never get a response; no agent container is started; no logs about "Processing messages" for the dashboard group.

### Pitfall 3: Log File Uses pino-pretty Text Format, Not JSON

**What goes wrong:** The `/api/logs` endpoint tries `JSON.parse(line)` on each log line and gets parse errors for all lines.

**Why it happens:** `src/logger.ts` uses `transport: { target: 'pino-pretty' }`, and the systemd unit redirects stdout (the pretty-printed stream) to `logs/nanoclaw.log`. The file contains ANSI-coloured human-readable text, not raw JSON.

**How to avoid:** Parse lines as text using the pino-pretty pattern `[TIME] LEVEL (pid): message`. Strip ANSI codes first.

**Warning signs:** All log entries show as parse errors; the raw file starts with `[21:53:` not `{"level":`.

### Pitfall 4: setTyping Called for web:dashboard Before Channel is Registered in channels[]

**What goes wrong:** `processGroupMessages` calls `await channel.setTyping?.(chatJid, true)` where `channel = findChannel(channels, chatJid)`. If the `WebDashboardChannel` is not in the `channels` array yet, `channel` is `undefined` and the function returns early at the null check.

**Why it happens:** Startup order — `WebDashboardChannel` instance created in `main()` but not added to `channels` before `loadState()`.

**How to avoid:** Add the `WebDashboardChannel` instance to `channels` before calling `recoverPendingMessages()` and `startMessageLoop()`.

### Pitfall 5: React useEffect Polling Cleanup

**What goes wrong:** After navigating away from a panel (switching sidebar item), the polling `setInterval` continues running in the background, stacking up fetches and causing state updates on unmounted components.

**Why it happens:** `setInterval` without cleanup in `useEffect`.

**How to avoid:** Always return a cleanup function from `useEffect`:

```typescript
useEffect(() => {
  const id = setInterval(fetchData, 10000);
  fetchData(); // immediate first fetch
  return () => clearInterval(id);
}, []);
```

### Pitfall 6: WebSocket Reconnection on SPA Navigation

**What goes wrong:** The WebSocket connection is created inside the `ChatPanel` component. When the user switches away from Chat and back, a new WebSocket connection is created while the old one may still be open.

**Why it happens:** Component mount/unmount creates and closes WebSocket on each navigation.

**How to avoid:** Create the WebSocket connection once at the `App` level (or use a `useRef` that persists across renders), and pass the `ws` instance down to `ChatPanel` via props or context. Alternatively, use `useRef` to hold the WS instance and only create it if `ws.current` is null or closed.

---

## Code Examples

### React Polling Hook Pattern

```typescript
// Used by OverviewPanel, ContainersPanel, LogsPanel
function usePoll<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [url, intervalMs]);

  return { data, error };
}
```

### Inline Confirm Button Pattern

```typescript
// Used by ContainersPanel for OPS-02 and OPS-03
function ActionButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="flex gap-2">
        <button onClick={() => { onConfirm(); setConfirming(false); }}
          className="text-red-400 hover:text-red-300 text-xs">Confirm?</button>
        <button onClick={() => setConfirming(false)}
          className="text-gray-500 hover:text-gray-300 text-xs">Cancel</button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)}
      className="text-gray-400 hover:text-gray-200 text-xs">{label}</button>
  );
}
```

### Three-Dot Typing Indicator

```typescript
// Used by ChatPanel for CHAT-04
function TypingIndicator() {
  return (
    <div className="flex gap-1 px-3 py-2 bg-gray-800 rounded-2xl w-fit">
      {[0, 1, 2].map(i => (
        <span key={i}
          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}
```

### WebSocket Lifecycle in ChatPanel

```typescript
// Single WS instance per App session using useRef
const wsRef = useRef<WebSocket | null>(null);

useEffect(() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
  wsRef.current = ws;

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'message') {
      setMessages(prev => [...prev, { from: 'deltron', text: msg.text }]);
      setTyping(false);
    } else if (msg.type === 'typing') {
      setTyping(msg.value);
    }
  };
  ws.onclose = () => { wsRef.current = null; };

  return () => ws.close();
}, []); // empty deps — create once per mount

const sendMessage = (text: string) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({ text }));
  }
};
```

### Log Line Parser (ANSI-stripped pino-pretty)

```typescript
// src/dashboard/routes/logs.ts
const ANSI = /\x1B\[[0-9;]*m/g;
const HEADER = /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s+(\w+)\s+\(\d+\):\s+(.*)/;

interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug' | 'fatal' | 'trace';
  message: string;
  raw: string;
}

function parseLogLines(rawLines: string[]): LogEntry[] {
  const entries: LogEntry[] = [];
  let current: LogEntry | null = null;

  for (const rawLine of rawLines) {
    const line = rawLine.replace(ANSI, '').trimEnd();
    const m = line.match(HEADER);
    if (m) {
      if (current) entries.push(current);
      current = {
        timestamp: m[1],
        level: m[2].toLowerCase() as LogEntry['level'],
        message: m[3],
        raw: line,
      };
    } else if (current && line.trim()) {
      // Continuation line (key: value field) — append to message
      current.message += ' ' + line.trim();
      current.raw += '\n' + line;
    }
  }
  if (current) entries.push(current);
  return entries;
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Passing global state via module singletons in routes | Dependency injection via factory functions | Avoids circular imports between index.ts and server.ts |
| Native browser WebSocket with no reconnect | Reconnect on next panel visit (acceptable for v1) | Simple; no reconnect logic needed for single-user LAN tool |

**Confirmed current:** Tailwind v4 uses `@tailwindcss/vite` plugin, not the legacy PostCSS setup. The `tw-animate-css` package is already installed for animation utilities beyond Tailwind's built-in `animate-bounce`.

---

## Open Questions

1. **IPC queue depth definition**
   - What we know: `data/ipc/*/messages/` contains outbound IPC files written by the agent; `data/ipc/*/input/` contains inbound messages to the active container
   - What's unclear: Which directory best represents "queue depth" for the stats card? Messages dir (outbound from agent) is likely empty once processed; input dir holds messages being delivered to the container
   - Recommendation: Count `.json` files in ALL `data/ipc/*/input/` and `data/ipc/*/messages/` dirs. If both are always empty outside active processing, consider using `queue.getSnapshot().filter(s => s.pendingMessages || s.pendingTasks.length > 0).length` instead, which counts groups with queued work.

2. **pino-pretty log format stability**
   - What we know: Current format confirmed as `[HH:MM:SS.mmm] LEVEL (pid): message`
   - What's unclear: This format can change with pino-pretty version upgrades
   - Recommendation: Return raw ANSI-stripped lines as `raw` field in addition to parsed fields; frontend can fall back to rendering `raw` if structured parse fails.

3. **web:dashboard session isolation from DB**
   - What we know: `web:dashboard` group should NOT be in `registered_groups` table
   - What's unclear: `loadState()` calls `getAllRegisteredGroups()` which reads from DB — if the group is ever accidentally persisted, it reappears after restart with wrong settings
   - Recommendation: In `registerGroup()`, add a guard: if `jid === 'web:dashboard'`, reject silently. The in-memory registration happens separately in `main()`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose 2>&1 \| tail -20` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVER-01 | `/api/stats` returns correct shape | unit | `npm test -- src/dashboard/routes/stats.test.ts` | Wave 0 |
| OVER-02 | Auto-refresh (client-side interval) | manual-only | n/a — interval behavior not unit-testable without real browser | n/a |
| CHAT-01 | `web:dashboard` JID routes to agent pipeline | unit | `npm test -- src/dashboard/chat-handler.test.ts` | Wave 0 |
| CHAT-02 | WS client receives agent response frame | integration | `npm test -- src/dashboard/chat-handler.test.ts` | Wave 0 |
| CHAT-03 | `web:dashboard` messages not routed to Telegram | unit | `npm test -- src/dashboard/chat-handler.test.ts` | Wave 0 |
| CHAT-04 | Typing indicator frames sent around agent run | unit | `npm test -- src/dashboard/chat-handler.test.ts` | Wave 0 |
| OPS-01 | `/api/containers` returns group states | unit | `npm test -- src/dashboard/routes/containers.test.ts` | Wave 0 |
| OPS-02 | POST clear calls `clearSession` | unit | `npm test -- src/dashboard/routes/containers.test.ts` | Wave 0 |
| OPS-03 | POST restart calls `queue.closeStdin` | unit | `npm test -- src/dashboard/routes/containers.test.ts` | Wave 0 |
| OPS-04 | `/api/logs` returns 200 parsed log entries | unit | `npm test -- src/dashboard/routes/logs.test.ts` | Wave 0 |
| OPS-05 | 5s auto-refresh (client-side interval) | manual-only | n/a | n/a |
| GRP-01 | `/api/groups` returns registered groups | unit | existing tests (no new test needed) | existing |
| GRP-02 | `/api/channels` returns channel connection status | unit | `npm test -- src/dashboard/routes/channels.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test 2>&1 | tail -5`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/dashboard/routes/stats.test.ts` — covers OVER-01
- [ ] `src/dashboard/routes/containers.test.ts` — covers OPS-01, OPS-02, OPS-03
- [ ] `src/dashboard/routes/logs.test.ts` — covers OPS-04
- [ ] `src/dashboard/routes/channels.test.ts` — covers GRP-02
- [ ] `src/dashboard/chat-handler.test.ts` — covers CHAT-01, CHAT-02, CHAT-03, CHAT-04

---

## Sources

### Primary (HIGH confidence)

- Direct file reading: `src/index.ts`, `src/dashboard/server.ts`, `src/group-queue.ts`, `src/channels/registry.ts`, `src/types.ts`, `src/logger.ts`, `src/config.ts`, `src/db.ts`, `src/todo.ts`, `src/ipc.ts`
- Direct file reading: `dashboard/src/App.tsx`, `dashboard/vite.config.ts`, `dashboard/package.json`
- Direct file reading: `package.json`, `vitest.config.ts`
- Direct observation: `logs/nanoclaw.log` format (pino-pretty ANSI text, confirmed)
- Direct observation: `/home/tris/.config/systemd/user/nanoclaw.service` (log file path `logs/nanoclaw.log`)
- Direct observation: `data/ipc/` directory structure (`input/`, `messages/`, `tasks/` subdirs per group)

### Secondary (MEDIUM confidence)

- `.planning/phases/02-operational-panels/02-CONTEXT.md` — architectural decisions recorded from discussion session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed via `package.json` inspection
- Architecture: HIGH — integration points verified by reading actual source files
- Pitfalls: HIGH — circular import risk, pino-pretty format, and web:dashboard registration all verified from source
- Test mapping: MEDIUM — test file paths are proposed, not yet created

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable dependencies; re-verify if pino or pino-pretty is upgraded)
