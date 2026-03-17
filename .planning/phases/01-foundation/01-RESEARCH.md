# Phase 1: Foundation - Research

**Researched:** 2026-03-15
**Domain:** Express HTTP server + React/Vite SPA scaffold integrated into an existing Node.js/TypeScript process
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Dashboard HTTP server starts with NanoClaw process on a configurable port (default 3030) | Express 5 server factory pattern; `startDashboardServer(port, deps)` called from `main()` in `src/index.ts` after `initDatabase()` |
| INFRA-02 | Dashboard serves React SPA static files from `dashboard/dist/` in production | `express.static(distPath)` + `app.get('*', sendFile('index.html'))` catch-all; Vite `npm run build` outputs to `dashboard/dist/` |
| INFRA-03 | Dashboard HTTP server is registered in the existing NanoClaw shutdown handler (SIGTERM/SIGINT) | `dashboardServer.close()` must be added as the first call inside the existing `shutdown()` function in `src/index.ts` — not a separate handler |
| INFRA-04 | Dashboard WebSocket server shares the same HTTP server port as REST endpoints | `new WebSocketServer({ server: httpServer, path: '/ws/chat' })` attaches `ws` to the same `http.Server` instance |
| INFRA-05 | Dashboard is accessible on LAN (binds to 0.0.0.0, not 127.0.0.1) | `server.listen(port, '0.0.0.0', ...)` — log a startup warning when binding to all interfaces |
| INFRA-06 | Vite dev server proxies API and WebSocket requests to the backend | `vite.config.ts` `server.proxy`: HTTP proxy for `/api` and `ws: true` proxy for `/ws` |
</phase_requirements>

---

## Summary

Phase 1 establishes the two foundational components that every subsequent phase depends on: (1) an Express HTTP server with a WebSocket server wired into the existing NanoClaw process and shutdown handler, and (2) a React/Vite SPA scaffolded in `dashboard/` with a working dev proxy and a verified production build pipeline.

The NanoClaw backend already uses a well-defined single-process model with a clear shutdown handler in `src/index.ts` (lines 507-513). Adding the dashboard requires one new module (`src/dashboard/server.ts`) and a minimal two-line addition to `main()` — the `startDashboardServer()` call and a `dashboardServer.close()` registration in the existing `shutdown()` function. No other existing files need modification in Phase 1.

The React SPA lives in `dashboard/` as a completely separate Vite project with its own `package.json` and `tsconfig.json`. This separation is mandatory: the existing backend `tsc` compilation (ES2022 target, NodeNext module resolution) cannot process JSX or browser-targeting code. The full stack is already researched and version-pinned in `.planning/research/STACK.md` — React 19, Vite 8, Tailwind CSS 4, shadcn/ui CLI v4, Express 5, ws 8.

**Primary recommendation:** Create `src/dashboard/server.ts` returning an `http.Server`, call it from `main()`, register its `close()` in the existing shutdown handler, then scaffold `dashboard/` with `npm create vite@latest`. Verify the production build pipeline end-to-end before closing Phase 1.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 5.2.x | HTTP server and static file serving | npm default since Mar 2025; async error propagation fixed in v5; minimal surface area for 2–3 routes in Phase 1 |
| ws | 8.18.x | WebSocket server | Standard Node.js raw WS library; attaches to `http.Server` directly; no proprietary framing; browser native `WebSocket` API works without additional client library |
| React | 19.2.x | UI framework | Current stable; compatible with all selected libraries |
| Vite | 8.x | Build tool + dev server | Rolldown-powered; 10–30x faster builds; `npm create vite@latest --template react-ts` scaffolds complete TypeScript SPA |
| TypeScript | 5.7.x | Type safety | Already in use in NanoClaw backend (5.7.0); shared type definitions possible via `src/shared/` |
| Tailwind CSS | 4.2.x | Styling | Required by shadcn/ui; zero config file with `@tailwindcss/vite` plugin |
| shadcn/ui (CLI v4) | latest | Component library | Components copied into repo; built on Radix UI; Tailwind v4 compatible as of Feb 2025 |

### Supporting (Phase 1 scope only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | latest | React Fast Refresh + JSX transform | Required Vite plugin for React SPA |
| lucide-react | latest | Icons | Default shadcn/ui icon set |
| tw-animate-css | latest | Animations | shadcn/ui v4 default; required for Dialog, Sheet, Dropdown transitions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Express 5 | Fastify | Fastify is faster but Express is appropriate at single-user scale; codebase already follows Express-style middleware thinking in credential proxy |
| ws | Socket.IO | Socket.IO adds 200KB client bundle and proprietary framing; overkill for single-user dashboard; native browser `WebSocket` is sufficient |
| Vite 8 | Next.js | Next.js adds SSR and framework coupling; the frontend is a pure client-side SPA reading from REST/WS |

**Installation:**
```bash
# Frontend — in repo root
npm create vite@latest dashboard -- --template react-ts
cd dashboard
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
npm install lucide-react tw-animate-css

# Backend — in repo root
npm install express ws
npm install -D @types/express @types/ws
```

---

## Architecture Patterns

### Recommended Project Structure

```
nanoclaw/
├── src/
│   ├── dashboard/
│   │   ├── server.ts          # HTTP server factory: Express + http.Server + WebSocketServer
│   │   └── routes/
│   │       └── health.ts      # GET /api/health (Phase 1 only)
│   └── index.ts               # Modified: calls startDashboardServer() + closes in shutdown()
│
└── dashboard/                 # React SPA (separate Vite project)
    ├── index.html
    ├── vite.config.ts         # Proxy: /api → Express, /ws → Express ws:true
    ├── tsconfig.json
    ├── package.json
    └── src/
        ├── main.tsx
        ├── App.tsx            # Sidebar layout with placeholder panel
        └── components/
            └── ui/            # shadcn/ui copied components
```

### Pattern 1: Single HTTP Server with Shared `http.Server`

**What:** Create one `http.createServer(expressApp)` and attach `ws.WebSocketServer({ server })` to it. Both REST and WebSocket share TCP port 3030.

**When to use:** Always — this is the canonical `ws` + Express integration. Avoids a second port.

**Example:**
```typescript
// Source: ws GitHub README + Express docs pattern
// src/dashboard/server.ts
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';

export function startDashboardServer(port: number, bindHost: string): http.Server {
  const app = express();
  app.use(express.json());

  // Phase 1: health check endpoint only
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // Production static file serving — API routes MUST come before this
  const distPath = path.resolve(process.cwd(), 'dashboard', 'dist');
  app.use(express.static(distPath));
  // SPA catch-all — MUST be last
  app.get('*', (_req, res) =>
    res.sendFile(path.join(distPath, 'index.html'))
  );

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/chat' });
  // Phase 1: ws server created but no message handlers yet

  server.listen(port, bindHost, () => {
    if (bindHost === '0.0.0.0') {
      // Warn when binding to all interfaces
      console.warn(`Dashboard bound to 0.0.0.0:${port} — accessible on LAN (no auth)`);
    }
  });

  return server;  // caller registers server.close() in shutdown handler
}
```

### Pattern 2: Shutdown Handler Extension (CRITICAL)

**What:** Add `dashboardServer.close()` as the FIRST statement inside the existing `shutdown()` function in `src/index.ts`. Do NOT create a second SIGTERM handler.

**When to use:** Mandatory — any HTTP server not closed in the shutdown handler causes the NanoClaw process to hang for 90 seconds under systemd before forced kill.

**Example:**
```typescript
// Source: src/index.ts — extend existing shutdown(), do not duplicate it
const dashboardServer = startDashboardServer(DASHBOARD_PORT, DASHBOARD_BIND);

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received');
  dashboardServer.close();  // ADD THIS — must be first
  proxyServer.close();
  await queue.shutdown(10000);
  for (const ch of channels) await ch.disconnect();
  process.exit(0);
};
```

### Pattern 3: Vite Dev Proxy Configuration

**What:** Configure Vite's `server.proxy` to forward `/api/*` (HTTP) and `/ws` (WebSocket) to the NanoClaw backend. Both must be configured separately — HTTP proxy does not forward WS upgrades.

**Example:**
```typescript
// Source: https://vite.dev/guide/backend-integration
// dashboard/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3030',
      '/ws': {
        target: 'ws://localhost:3030',
        ws: true,                          // REQUIRED — without this, WS upgrade is not proxied
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

### Pattern 4: Express Route Ordering for SPA + API

**What:** API routes must be registered before `express.static()`, which must come before the `app.get('*')` catch-all. Wrong order causes API calls to return HTML.

**Correct order:**
```
1. app.use(express.json())
2. app.use('/api/...', router)    ← REST routes first
3. app.use(express.static(dist))  ← static files second
4. app.get('*', sendFile('index.html'))  ← SPA fallback last
```

### Anti-Patterns to Avoid

- **Duplicating the shutdown handler:** Adding a second `process.on('SIGTERM', ...)` in `server.ts` creates a race condition with the existing handler in `index.ts`. Always extend the existing handler.
- **Relative path for `dashboard/dist`:** `express.static('./dashboard/dist')` breaks when systemd sets cwd to `/`. Always use `path.resolve(process.cwd(), 'dashboard', 'dist')` or `path.resolve(__dirname, '..', '..', 'dashboard', 'dist')`.
- **Vite source inside `src/`:** The existing backend `tsc` config compiles everything under `src/`. JSX files there will fail compilation. `dashboard/` must be a fully separate Vite project at the repo root.
- **Skipping production build verification:** Vite dev proxy can hide Express misconfiguration. Must test `npm run build` + actual Express static serving before Phase 1 is complete.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP server with WS on same port | Custom TCP multiplexer | `ws` + `http.Server` | `ws` was designed for exactly this; one-line integration |
| Static file serving with MIME types | Custom file server | `express.static()` | Handles MIME, ETag, gzip, range requests, directory index — not worth custom code |
| SPA HTML5 history fallback | Custom 404 handler | `app.get('*', sendFile)` | Express pattern; handles all unmatched non-API routes |
| React component library | Hand-rolled UI | shadcn/ui | Accessible keyboard navigation, focus management, ARIA on all interactive components |
| Dev proxy | Custom Express middleware | Vite `server.proxy` | Vite handles CORS, WS upgrades, hot reload — custom proxy would need all of this |

**Key insight:** The NanoClaw backend is already well-structured. Phase 1 adds one new module and two lines to `index.ts`. Resist the temptation to restructure existing code.

---

## Common Pitfalls

### Pitfall 1: Dashboard HTTP Server Not in Shutdown Handler

**What goes wrong:** The process receives SIGTERM. The existing `shutdown()` handler runs `proxyServer.close()` and `process.exit(0)`. But the Express HTTP server has keep-alive connections from the browser. Those connections hold the event loop open. The process cannot exit. systemd waits 90 seconds, then force-kills it.

**Why it happens:** Server created in a new code block, developer forgets to register its `close()` in the existing handler.

**How to avoid:** Store the `http.Server` returned by `startDashboardServer()` in `main()`. The very first line added to the existing `shutdown()` function must be `dashboardServer.close()`. Do not create a second SIGTERM handler.

**Warning signs:** `systemctl restart nanoclaw` hangs for ~90 seconds; logs show "Shutdown signal received" but process does not exit promptly.

### Pitfall 2: Wrong Route Order Breaks API in Production

**What goes wrong:** In dev, Vite proxies `/api` requests to Express directly — Express route order doesn't matter because static files are never served. In production, `express.static(dist)` intercepts everything. If the SPA catch-all `app.get('*', ...)` is placed before `/api` routes, every API call returns `index.html` with status 200.

**How to avoid:** Always register API routes before `express.static()` and the `app.get('*')` catch-all. Test locally: `npm run build` in `dashboard/`, restart NanoClaw, and verify `/api/health` returns JSON.

**Warning signs:** API calls return `content-type: text/html`; browser Network tab shows 200 on API calls with HTML response body.

### Pitfall 3: Vite Proxy Missing WebSocket Upgrade

**What goes wrong:** Dev proxy configured for `/api` only. Vite forwards HTTP requests but not WebSocket upgrade requests. Browser WebSocket connects to Vite dev server port 5173 — no WS server there — and gets a 426 or connection error.

**How to avoid:** In `vite.config.ts`, the `/ws` proxy entry must include `ws: true`. HTTP and WS proxies are configured independently. Without `ws: true`, the HTTP proxy silently ignores WS upgrade requests.

**Warning signs:** WebSocket connects fine in production but fails in dev mode with a connection error; no error in Express logs because the upgrade never reaches the backend.

### Pitfall 4: Dashboard Port Conflicts with Credential Proxy

**What goes wrong:** Default dashboard port 3030 is chosen to avoid the credential proxy at 3001. If both are set to the same port, Express `listen()` throws `EADDRINUSE` and the process fails to start.

**How to avoid:** Use port 3030 as default (not 3000 or 3001). Read from `DASHBOARD_PORT` env var. Add a startup check that logs both ports to make conflicts obvious.

**Warning signs:** `Error: listen EADDRINUSE :::3030`; process exits immediately after DB init.

### Pitfall 5: `dist/` Path Relative to Process Working Directory

**What goes wrong:** `express.static('./dashboard/dist')` works when running `npm run dev` from the project root (cwd = `/home/tris/nanoclaw`). When systemd starts the service, cwd may be set to `/` or the user home directory. The relative path resolves to the wrong location and Express returns 404 for all static assets.

**How to avoid:** Use `path.resolve(process.cwd(), 'dashboard', 'dist')`. Better: derive the path from `import.meta.url` in ESM context or from the NanoClaw `PROJECT_ROOT` constant already defined in `src/config.ts` (`const PROJECT_ROOT = process.cwd()`).

---

## Code Examples

Verified patterns from official sources:

### Express 5 + ws on Shared Port

```typescript
// Source: ws README https://github.com/websockets/ws#readme
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/chat' });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    ws.send(`echo: ${data}`);
  });
});

server.listen(3030, '0.0.0.0');
```

### Express Static + SPA Fallback (Correct Order)

```typescript
// Source: Express 5 docs + well-established SPA serving pattern
// API routes FIRST
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Static files SECOND
app.use(express.static(path.resolve(process.cwd(), 'dashboard', 'dist')));

// SPA catch-all LAST
app.get('*', (_req, res) =>
  res.sendFile(path.join(path.resolve(process.cwd(), 'dashboard', 'dist'), 'index.html'))
);
```

### Vite Config with WS Proxy

```typescript
// Source: https://vite.dev/guide/backend-integration
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3030',
      '/ws': { target: 'ws://localhost:3030', ws: true },
    },
  },
});
```

### dashboard/package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

### Root package.json Additions

```json
{
  "scripts": {
    "build:dashboard": "cd dashboard && npm run build",
    "build:all": "npm run build:dashboard && npm run build"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create React App | Vite 8 with Rolldown | CRA deprecated 2023, Vite 8 Mar 2026 | Vite 8 is 10–30x faster builds; CRA does not support React 19 |
| Express 4 (needs try/catch in async routes) | Express 5 (async errors propagate automatically) | Express 5 became npm default Mar 2025 | Unhandled async route errors no longer silently swallow |
| `tailwindcss-animate` | `tw-animate-css` | shadcn/ui v4 migration 2025 | Old package causes animation breakage in fresh shadcn/ui v4 installs |
| `react-router-dom` (separate package) | `react-router` (unified) | React Router v7 2024 | Import directly from `react-router`; `react-router-dom` re-exports are still available but add an unnecessary package |
| PostCSS config for Tailwind | `@tailwindcss/vite` plugin, no postcss.config | Tailwind v4 release 2025 | Zero config: just one CSS import, no `tailwind.config.js` |

**Deprecated/outdated:**
- `Create React App`: unmaintained, does not support React 19. Use Vite.
- `tailwindcss-animate`: replaced by `tw-animate-css` in shadcn/ui v4.
- `react-router-dom` as a separate import: merged into `react-router` in v7.

---

## Open Questions

1. **WAL mode not enabled in `initDatabase()`**
   - What we know: `src/db.ts` `initDatabase()` creates the SQLite database without `PRAGMA journal_mode=WAL`. WAL mode allows concurrent reads alongside writes without serializing. Phase 1 adds HTTP request handlers that read from SQLite in the same process as the message loop. Without WAL, a slow message-loop write will block an HTTP read.
   - What's unclear: Whether the current message loop write frequency is high enough to cause visible HTTP latency in practice during Phase 1. Phase 1 only adds a `/api/health` endpoint with no DB reads, so impact is zero in Phase 1. Phase 2 will add DB-reading endpoints.
   - Recommendation: Enable WAL mode in `initDatabase()` as part of Phase 1 (it is a one-liner `db.pragma('journal_mode = WAL')`). Zero risk, potential upside when Phase 2 REST endpoints land.

2. **Default dashboard port: 3030 vs 3000**
   - What we know: `CREDENTIAL_PROXY_PORT` defaults to 3001. The research uses port 3000 in some examples but the requirements specify 3030. The STATE.md confirms 3030 was the agreed default.
   - Recommendation: Use 3030 as the default throughout; all code examples in this document use 3030.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (root) — includes `src/**/*.test.ts` |
| Quick run command | `npm test -- --run src/dashboard` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | `startDashboardServer()` listens on specified port | unit | `npm test -- --run src/dashboard/server.test.ts` | Wave 0 |
| INFRA-02 | `GET /` returns `index.html` from `dashboard/dist/` | unit | `npm test -- --run src/dashboard/server.test.ts` | Wave 0 |
| INFRA-03 | `server.close()` is called when SIGTERM shutdown handler fires | unit | `npm test -- --run src/dashboard/server.test.ts` | Wave 0 |
| INFRA-04 | WebSocket server accepts upgrade at `/ws/chat` on same port | unit | `npm test -- --run src/dashboard/server.test.ts` | Wave 0 |
| INFRA-05 | Server binds to `0.0.0.0` (not `127.0.0.1`) | unit | `npm test -- --run src/dashboard/server.test.ts` | Wave 0 |
| INFRA-06 | Vite dev proxy: `/api` and `/ws` forward to backend | manual-only | N/A — requires running Vite dev server; verify manually with `curl` + WS client | N/A |

INFRA-06 is manual-only because it requires two live processes (Vite dev server + NanoClaw backend). Document the manual verification steps in the plan.

### Sampling Rate

- **Per task commit:** `npm test -- --run src/dashboard/server.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/dashboard/server.test.ts` — covers INFRA-01 through INFRA-05 using Vitest + `supertest` for HTTP assertions and a raw `http.get` with upgrade for WS smoke test
- [ ] `npm install -D supertest @types/supertest` — HTTP assertion library for Express route tests (not currently in project)

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md` — full technology stack with version pins; React 19, Vite 8, Tailwind 4, shadcn/ui CLI v4, Express 5, ws 8
- `.planning/research/ARCHITECTURE.md` — `startDashboardServer()` pattern, DashboardDeps interface, file structure, data flow diagrams
- `.planning/research/PITFALLS.md` — all pitfalls documented with NanoClaw-specific root causes and prevention strategies
- `src/index.ts` — shutdown handler (lines 507-513); credential proxy server pattern; `main()` startup sequence
- `src/config.ts` — `PROJECT_ROOT`, `CREDENTIAL_PROXY_PORT` (3001 default), existing env var patterns
- `src/db.ts` line 184 — `initDatabase()` confirmed: no WAL mode pragma set
- `vitest.config.ts` — existing test config; `include: ['src/**/*.test.ts']`
- [Vite backend integration docs](https://vite.dev/guide/backend-integration) — `ws: true` proxy requirement confirmed

### Secondary (MEDIUM confidence)

- [Express 5 healthcheck + graceful shutdown](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html) — `server.close()` keep-alive behavior
- [ws README](https://github.com/websockets/ws#readme) — `WebSocketServer({ server })` integration pattern

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions and libraries pinned in `.planning/research/STACK.md` from verified sources
- Architecture: HIGH — file structure and integration patterns confirmed by code inspection of `src/index.ts`, `src/config.ts`, `src/db.ts`
- Pitfalls: HIGH — all critical pitfalls grounded in actual NanoClaw source code; shutdown handler pattern verified line-by-line

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (30 days; all dependencies are stable releases)
