# Architecture Research

**Domain:** React SPA dashboard integrated into existing Node.js orchestrator process
**Researched:** 2026-03-15
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Chat UI  │  │ Groups   │  │ Tasks /  │  │ Logs / Memory  │  │
│  │ (WS)     │  │ Status   │  │ Todos    │  │ Editor         │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬────────┘  │
│       │ WebSocket   │ REST polling │ REST polling    │ REST      │
└───────┼─────────────┼─────────────┼─────────────────┼───────────┘
        │             │             │                 │
┌───────┼─────────────┼─────────────┼─────────────────┼───────────┐
│       │    NanoClaw Node.js Process (src/index.ts)  │           │
│  ┌────┴──────────────────────────────────────────────┴────────┐  │
│  │               src/dashboard/server.ts                      │  │
│  │   Express app + http.Server + ws.WebSocketServer           │  │
│  │   Static file serving (dashboard/dist/)                    │  │
│  │   REST routes (/api/*)                                     │  │
│  │   WebSocket endpoint (/ws/chat)                            │  │
│  └──────────────┬─────────────────────────────────────────────┘  │
│                 │ reads / writes via existing functions            │
│  ┌──────────────┼─────────────────────────────────────────────┐  │
│  │  Existing Subsystems                                        │  │
│  │  ┌────────┐ ┌────────┐ ┌───────────────┐ ┌─────────────┐  │  │
│  │  │ db.ts  │ │todo.ts │ │task-scheduler │ │  ipc.ts     │  │  │
│  │  └────────┘ └────────┘ └───────────────┘ └─────────────┘  │  │
│  │             SQLite: store/messages.db                       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Channel Layer (Telegram, Gmail — unchanged)                │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| `src/dashboard/server.ts` | Create Express app, http.Server, WebSocketServer; mount routes; serve static files | New file |
| `src/dashboard/routes/` | Express Router instances for each REST domain | New files |
| `src/dashboard/ws-handler.ts` | WebSocket connection lifecycle, message dispatch, broadcast helpers | New file |
| `dashboard/` (repo root) | React + Vite SPA source — entirely separate from `src/` | New directory |
| `dashboard/dist/` | Vite build output — served as static files by Express | Generated |
| `src/index.ts` (modified) | Call `startDashboardServer()` after DB init, pass in shared state refs | Minimal change |

## Recommended Project Structure

```
nanoclaw/
├── src/
│   ├── dashboard/
│   │   ├── server.ts          # HTTP server factory: Express + http.Server + WebSocketServer
│   │   ├── ws-handler.ts      # WebSocket connection handling and broadcast
│   │   └── routes/
│   │       ├── groups.ts      # GET /api/groups, GET /api/groups/:id
│   │       ├── messages.ts    # GET /api/messages?chatJid=&limit=
│   │       ├── tasks.ts       # CRUD /api/tasks
│   │       ├── todos.ts       # CRUD /api/todos
│   │       ├── logs.ts        # GET /api/logs?group=&lines=
│   │       ├── memory.ts      # GET/PUT /api/memory/:folder
│   │       ├── usage.ts       # GET /api/usage (spawns claude /usage via execFile)
│   │       └── actions.ts     # POST /api/actions (clear-session, compact-context)
│   ├── index.ts               # Modified: calls startDashboardServer()
│   ├── db.ts                  # Unchanged — routes call these functions directly
│   ├── todo.ts                # Unchanged
│   ├── task-scheduler.ts      # Unchanged
│   └── ...                    # All other existing files unchanged
│
└── dashboard/                 # React SPA (Vite project root)
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── package.json           # Separate deps: react, react-dom, etc.
    ├── dist/                  # Vite build output (gitignored except via build step)
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── components/
        │   ├── Chat.tsx        # WebSocket chat panel
        │   ├── GroupList.tsx
        │   ├── TaskManager.tsx
        │   ├── LogViewer.tsx
        │   └── MemoryEditor.tsx
        ├── hooks/
        │   ├── useWebSocket.ts  # WS connection + reconnect
        │   └── useApi.ts        # Polling REST calls
        └── api/
            └── client.ts        # Typed fetch wrappers for all /api/* endpoints
```

### Structure Rationale

- **`src/dashboard/` under `src/`:** Backend code stays with backend. Routes are plain TypeScript modules that call existing `db.ts` / `todo.ts` functions — no indirection layer needed.
- **`dashboard/` at repo root (not under `src/`):** React/Vite is a completely separate compilation target with its own `package.json`, `tsconfig.json`, and `node_modules`. Mixing frontend source into `src/` would confuse the backend `tsc` build.
- **`dashboard/dist/` as Vite output:** Express serves this directory as static files in production. In development, run Vite's dev server separately on a different port (proxied via `vite.config.ts`).
- **Routes split by domain:** Each route file is a standalone Express Router. Adding a new panel means adding one file and one `app.use()` line — no changes to other routes.

## Architectural Patterns

### Pattern 1: Single HTTP Server with Shared `http.Server`

**What:** Create one `http.createServer(expressApp)` and pass that server instance to both Express (via `server.listen()`) and `ws.WebSocketServer({ server })`. Both share the same TCP port.

**When to use:** Always — this is how `ws` integrates cleanly with Express. Avoids needing a second port for WebSockets.

**Trade-offs:** Simple; one port to configure and firewall. No added complexity.

**Example:**
```typescript
// src/dashboard/server.ts
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';

export function startDashboardServer(port: number, deps: DashboardDeps): http.Server {
  const app = express();
  app.use(express.json());

  // REST routes
  app.use('/api/groups', groupsRouter(deps));
  app.use('/api/messages', messagesRouter());
  app.use('/api/tasks', tasksRouter());
  // ... other routers

  // Serve React SPA static files
  const distPath = path.resolve(process.cwd(), 'dashboard/dist');
  app.use(express.static(distPath));
  // SPA fallback: all unmatched routes return index.html
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

  const server = http.createServer(app);

  // WebSocket server shares the same http.Server instance
  const wss = new WebSocketServer({ server, path: '/ws/chat' });
  attachWsHandler(wss, deps);

  server.listen(port, '0.0.0.0', () => {
    console.log(`Dashboard on port ${port}`);
  });

  return server;
}
```

### Pattern 2: Dependency Injection via `DashboardDeps`

**What:** `startDashboardServer()` accepts a typed `DashboardDeps` object containing references to in-memory state and callback functions from `index.ts`. Routes do not import from `index.ts` directly (avoids circular imports).

**When to use:** Whenever a route needs access to `registeredGroups`, `sessions`, or `queue` — all of which live in `index.ts` module scope.

**Trade-offs:** Slightly more boilerplate than direct imports, but avoids circular dependency between `index.ts` and `dashboard/server.ts`. Makes routes unit-testable.

**Example:**
```typescript
// DashboardDeps interface
export interface DashboardDeps {
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
  getSessions: () => Record<string, string>;
  injectMessage: (chatJid: string, text: string) => void; // for dashboard chat
  clearSession: (chatJid: string) => void;
}
```

### Pattern 3: Dashboard Chat as a Virtual Channel

**What:** Register a `dashboard` group in the DB with `jid: 'dashboard:web'`. Messages from the dashboard are injected into the existing `onMessage` callback (same path as Telegram messages). Responses are broadcast back over the WebSocket.

**When to use:** This is the correct approach given the existing orchestrator design. The orchestrator already handles message routing, session isolation, and agent invocation — the dashboard should plug into that, not bypass it.

**Trade-offs:** Reuses all existing orchestrator logic for free. The WebSocket handler just needs to call `onMessage(dashboardJid, msg)` and register a broadcast function that IPC output can call.

**Example (integration in index.ts):**
```typescript
// index.ts addition — pass broadcast fn into IPC watcher or channel layer
const dashboardJid = 'dashboard:web';

// When agent sends output for dashboardJid, broadcast over WS instead of Telegram
// This can be handled in the existing onOutput callback by checking chatJid
```

## Data Flow

### REST Request Flow (Read)

```
Browser polling (every 5s)
    ↓ GET /api/messages?chatJid=tg:xxx&limit=50
Express route handler (routes/messages.ts)
    ↓ calls getMessagesSince() / getAllMessages() from db.ts
db.ts (better-sqlite3, synchronous)
    ↓ returns rows immediately
JSON response → Browser renders
```

Data direction: **Dashboard reads SQLite via existing `db.ts` functions** — not direct SQLite access from the route file, not a separate DB connection. This is non-negotiable: `db.ts` owns the prepared statements and connection; routes are consumers of its exported functions.

### REST Request Flow (Write)

```
Browser action (e.g. create task)
    ↓ POST /api/tasks with JSON body
Express route handler (routes/tasks.ts)
    ↓ calls createTask() from task-scheduler.ts or db.ts
SQLite write (synchronous via better-sqlite3)
    ↓ 200 OK
Task scheduler loop picks it up on next 60s poll
```

### WebSocket Chat Flow

```
Browser types message → sends WS frame
    ↓
ws-handler.ts receives frame
    ↓ calls deps.injectMessage('dashboard:web', text)
    ↓ → storeMessage() → DB
Message loop polls DB (every 2s)
    ↓ processGroupMessages('dashboard:web')
    ↓ runContainerAgent(dashboardGroup, ...)
Agent produces output
    ↓ onOutput callback checks chatJid === 'dashboard:web'
    ↓ calls deps.broadcastToWs(text) instead of channel.sendMessage()
WS broadcast → Browser displays agent reply
```

### State Management (Frontend)

```
React components
    ↓ (subscribe via useApi hook)
Polling intervals (useEffect + setInterval)
    ↓ GET /api/* every 5s (status panels)
Local React state (useState / useReducer)
    ↑ updated on each poll response

Chat panel is different:
React chat component
    ↓ (subscribe via useWebSocket hook)
WebSocket connection (auto-reconnect on disconnect)
    ↑ messages appended on each WS frame
```

No global state manager (Redux, Zustand) needed. Each panel owns its local state. The chat hook manages the WS connection. This keeps complexity proportionate to the scope.

## Build Pipeline

### Development Mode

Two processes run concurrently:

```
Terminal 1: npm run dev          # NanoClaw backend (tsx src/index.ts)
Terminal 2: cd dashboard && npm run dev  # Vite dev server (port 5173)
```

Vite config sets `server.proxy` to forward `/api/*` and `/ws/*` to localhost:3000. The React app at localhost:5173 talks to the backend at localhost:3000 transparently.

```typescript
// dashboard/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  build: { outDir: '../dashboard/dist' },
});
```

### Production Mode (Normal Operation)

```
npm run build:dashboard   # cd dashboard && vite build → dashboard/dist/
npm run build             # tsc → dist/
npm start                 # serves both: Express static + REST + WS all on port 3000
```

NanoClaw's main `package.json` gains a `build:dashboard` script and an optional `build:all` that runs both. The systemd service only runs `npm start` — no change to service management.

### Build Integration in package.json (root)

```json
{
  "scripts": {
    "build": "tsc",
    "build:dashboard": "cd dashboard && npm run build",
    "build:all": "npm run build:dashboard && npm run build",
    "start": "node dist/index.js"
  }
}
```

Dashboard `dist/` is not committed to git. It is built before deployment. A `postinstall` script or CI step runs `build:all`.

## Integration Points

### How `src/index.ts` Changes

`index.ts` is modified in one place only — at the bottom of `main()`, after `initDatabase()` and `loadState()`:

```typescript
// In main(), after loadState():
const dashboardPort = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
const dashboardServer = startDashboardServer(dashboardPort, {
  getRegisteredGroups: () => registeredGroups,
  getSessions: () => sessions,
  injectMessage: (jid, text) => {
    const msg = buildDashboardMessage(jid, text);
    storeMessage(msg);
  },
  clearSession: (jid) => { /* reuse existing clearSession logic */ },
});
// Add dashboardServer.close() to shutdown handler
```

This is the **only** change to `index.ts`. All dashboard logic lives in `src/dashboard/`.

### `claude /usage` Subprocess

The usage route needs to run the `claude` CLI to get plan usage data. Use `execFile` (not `exec`) to avoid shell injection — consistent with the project's existing approach in `container-runner.ts`:

```typescript
// routes/usage.ts
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function getClaudeUsage(): Promise<string> {
  const { stdout } = await execFileAsync('claude', ['/usage'], { timeout: 10000 });
  return stdout;
}
```

Cache the result for 60 seconds — the usage CLI is slow and rate-limited.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `routes/*.ts` ↔ `db.ts` | Direct function calls | Routes import and call db.ts exported functions; no abstraction layer |
| `routes/*.ts` ↔ `todo.ts` | Direct function calls | Same pattern |
| `routes/actions.ts` ↔ `queue` | Via `DashboardDeps` callback | Queue lives in index.ts module scope; passed as dep |
| `ws-handler.ts` ↔ message loop | `storeMessage()` + existing loop poll | Dashboard messages stored in DB; loop picks them up within 2s |
| `ws-handler.ts` ↔ agent output | Broadcast callback registered in `onOutput` | When chatJid matches dashboard group, call broadcast instead of Telegram |
| Vite dev server ↔ Express | Proxy (`/api/*`, `/ws/*`) | Dev-only; production bypasses this |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `claude /usage` CLI | `execFile('claude', ['/usage'])` in `routes/usage.ts` | Run on demand; cache 60s |
| Pino log files | `fs.readFileSync()` in `routes/logs.ts` | Read tail of JSON log files; parse and return last N lines |
| `groups/*/CLAUDE.md` files | `fs.readFileSync` / `fs.writeFileSync` in `routes/memory.ts` | Validate path stays within `groups/` before writing |

## Anti-Patterns

### Anti-Pattern 1: Importing `db.ts` Directly from React Components

**What people do:** Use something like `better-sqlite3` in browser code or create a second SQLite connection in a separate process.
**Why it's wrong:** SQLite is a server-side library; `better-sqlite3` cannot run in a browser. A second connection in a separate process risks WAL conflicts.
**Do this instead:** All DB access flows through `src/dashboard/routes/` → `db.ts`. The browser only talks HTTP/WS to the Express server.

### Anti-Pattern 2: Adding Dashboard Routes Directly to `src/index.ts`

**What people do:** Inline Express route handlers inside `main()` or alongside the message loop.
**Why it's wrong:** `index.ts` is already 700 lines. Adding HTTP concerns to it creates an unmaintainable file and makes the dashboard impossible to test in isolation.
**Do this instead:** Create `src/dashboard/server.ts` as a self-contained module. `index.ts` calls `startDashboardServer()` with deps, nothing more.

### Anti-Pattern 3: WebSocket for All Dashboard Data

**What people do:** Push all data (groups, tasks, logs, todos) over WebSocket to avoid polling.
**Why it's wrong:** Most dashboard data changes infrequently (tasks: seconds to minutes, logs: seconds). WebSocket push for all panels requires server-side state diffing, subscription management, and reconnect replay — significant complexity with no user-visible benefit over a 5s poll.
**Do this instead:** WebSocket for chat only (the one panel that needs sub-second push). All other panels use `setInterval` polling via REST. This matches the project's own requirements (PROJECT.md: "polling is sufficient").

### Anti-Pattern 4: Vite Source Inside `src/`

**What people do:** Put React files under `src/components/` alongside TypeScript backend files.
**Why it's wrong:** `tsc` (backend build) will attempt to compile React/JSX files and fail. The two compilation pipelines have different targets, module formats, and tsconfig settings.
**Do this instead:** `dashboard/` is a fully separate Vite project at the repo root with its own `package.json` and `tsconfig.json`. The root `build:dashboard` script runs `cd dashboard && npm run build`.

### Anti-Pattern 5: Bypassing the Orchestrator for Dashboard Chat

**What people do:** Dashboard WebSocket handler calls `runContainerAgent()` directly, maintaining its own session state.
**Why it's wrong:** The orchestrator manages session IDs, cursor tracking, retry/backoff, concurrency limits, and IPC — duplicating this is a maintenance burden and risks race conditions (two containers for the same group).
**Do this instead:** Inject dashboard messages through `storeMessage()`, register the `dashboard` folder as a group, and let the existing message loop handle scheduling the container. Output is intercepted via the `onOutput` callback when `chatJid === dashboardJid`.

## Suggested Build Order

Dependencies flow from data to presentation:

1. **Database + REST foundation** — `src/dashboard/server.ts` skeleton, `/api/groups` and `/api/messages` read-only routes. Proves Express integrates cleanly before adding complexity. All other panels depend on the ability to read data.

2. **React SPA scaffold** — `dashboard/` Vite project, `App.tsx` with panel layout, `useApi` polling hook, wire to the two existing REST endpoints. Confirms the full pipeline (Vite build → Express static serve) works end-to-end.

3. **Remaining REST routes** — Tasks CRUD, todos, logs, memory editor, usage, actions. Each route is independent; build in any order. Tasks and todos depend on existing `db.ts` / `todo.ts` functions already tested.

4. **Dashboard chat group registration + WebSocket** — Register `dashboard:web` group in DB, add `ws-handler.ts`, implement broadcast in `onOutput` callback. This is the highest-risk item (touches the message loop) so it goes after the scaffolding is proven.

5. **Actions and quick controls** — Clear session, restart container, compact context. These require the orchestrator integration from step 4 to work correctly.

| Build Step | Depends On | Risk |
|------------|-----------|------|
| Express skeleton + 2 read routes | Nothing new | Low |
| React SPA scaffold + polling | Express skeleton | Low |
| Remaining REST routes | DB/todo.ts functions (existing) | Low |
| WebSocket + dashboard chat session | Message loop integration | Medium |
| Actions (clear session, restart) | Queue access via deps | Medium |

## Sources

- ws library: [https://github.com/websockets/ws](https://github.com/websockets/ws) — MEDIUM confidence (GitHub README, current)
- Express + ws integration pattern: [https://betterstack.com/community/guides/scaling-nodejs/express-websockets/](https://betterstack.com/community/guides/scaling-nodejs/express-websockets/) — MEDIUM confidence (WebSearch verified)
- Vite build output + Express static serving: [https://vite.dev/guide/build](https://vite.dev/guide/build) — HIGH confidence (official docs)
- SPA wildcard fallback pattern: standard Express + SPA pattern, well-established — HIGH confidence
- vite-express integration library: [https://github.com/szymmis/vite-express](https://github.com/szymmis/vite-express) — noted but NOT recommended here; `express.static()` is sufficient for this use case

---

*Architecture research for: NanoClaw React SPA Dashboard*
*Researched: 2026-03-15*
