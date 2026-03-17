# Stack Research

**Domain:** React + Vite SPA admin dashboard on an existing Node.js/TypeScript backend
**Researched:** 2026-03-15
**Confidence:** HIGH (all major choices verified against current official sources or npm registry)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2.x | UI framework | Current stable. New `use()` hook, concurrent features, React Compiler support. shadcn/ui and all major libs are React 19 compatible as of Feb 2025. |
| Vite | 8.x | Build tool + dev server | Latest stable (released Mar 2026). Rolldown-powered: 10–30x faster builds than Rollup, 3x faster dev server startup, built-in TypeScript. The `npm create vite@latest --template react-ts` scaffolds a complete TypeScript SPA. Replaces CRA entirely. |
| TypeScript | 5.7.x | Type safety | Already in use in NanoClaw (5.7.0). Shared types between frontend and backend eliminate a whole class of contract bugs. Vite handles `.tsx` natively with no extra config. |
| Tailwind CSS | 4.2.x | Styling | Current stable. 5x faster full builds, zero config file (just one CSS import). Required by shadcn/ui. Use the Vite plugin (`@tailwindcss/vite`) — no PostCSS config needed. |
| shadcn/ui (CLI v4) | latest | Component library | Not a package — components are copied into your repo via `npx shadcn@latest`. Built on Radix UI primitives (fully accessible, keyboard-navigable). Tailwind v4 support confirmed as of Feb 2025. Best-in-class for dashboards: Table, Dialog, Sheet, Tabs, Badge all available. You own the code, zero vendor lock-in. |
| Express | 5.2.x | HTTP server | Now the npm default (5.1.0+ marked latest, Mar 2025). Async error propagation fixed in v5 — unhandled promise rejections in route handlers no longer crash the process silently. Minimal surface area; NanoClaw only needs static file serving + a few REST routes + ws upgrade. Drop-in for existing credential proxy pattern. |
| ws | 8.18.x | WebSocket server | The standard raw WebSocket library for Node.js. Attaches to the Express `http.Server` instance directly. No proprietary framing (unlike Socket.IO), so the browser's native `WebSocket` API works on the client side with no extra dependency. `@types/ws` (8.18.1) is current. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.90.x | Server state / REST polling | Use for every REST API call in the dashboard. Handles refetch intervals (polling for container status, logs, tasks), background refresh, loading/error states, and devtools. Use `refetchInterval` for panels that need polling (every 5–30s). |
| react-router | 7.13.x | Client-side routing | SPA library mode (no framework mode needed — no SSR). Provides `<BrowserRouter>`, `<Route>`, `useParams`, `useNavigate`. Simpler than TanStack Router for a small-to-medium dashboard with no complex type-safe search params. |
| zustand | 5.0.x | Client-only UI state | Use for ephemeral UI state that doesn't come from the server: active panel, sidebar open/closed, WebSocket connection status, current chat session. Keep it small — TanStack Query owns all server state. |
| lucide-react | latest | Icons | Default icon set for shadcn/ui. Consistent, tree-shakeable SVG icons. Already assumed by shadcn/ui component imports. |
| tw-animate-css | latest | Animations | shadcn/ui v4 default (replaces `tailwindcss-animate`). Required for Dialog, Sheet, Dropdown open/close transitions. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@vitejs/plugin-react` | React Fast Refresh + JSX transform | Standard Vite plugin. Use `@vitejs/plugin-react` (Babel-backed) not `@vitejs/plugin-react-swc` unless build speed is a bottleneck — SWC occasionally lags on new React features. |
| `vite-plugin-checker` | TypeScript type checking in dev | Runs `tsc --noEmit` in a worker thread. Surfaces TS errors as browser overlays without slowing HMR. Recommended addition to the base template. |
| Vitest | Unit/component tests | Already in use in NanoClaw (4.0.18). Extend the existing `vitest.config.ts` with `jsdom` environment for React component tests. |
| `@vitest/ui` | Visual test runner | Optional but useful for iterating on component tests. Pairs with existing Vitest setup. |

---

## Installation

```bash
# In the NanoClaw repo root — frontend lives in dashboard/
npm create vite@latest dashboard -- --template react-ts
cd dashboard

# Tailwind CSS v4 (Vite plugin, no postcss.config needed)
npm install tailwindcss @tailwindcss/vite

# shadcn/ui (copies components into dashboard/src/components/ui/)
npx shadcn@latest init

# Routing + server state + client state
npm install react-router @tanstack/react-query zustand

# Icons + animations (shadcn/ui defaults)
npm install lucide-react tw-animate-css

# Dev tools
npm install -D vite-plugin-checker
```

```bash
# In the NanoClaw repo root — backend additions
npm install express ws
npm install -D @types/express @types/ws
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Express 5 | Fastify | Fastify is faster (2–3x throughput) and has first-class TypeScript. Choose Fastify for a new greenfield service. For NanoClaw, Express is the right call: the codebase already uses a credential proxy with similar express-style middleware thinking; the dashboard adds ~5 routes; performance is irrelevant at single-user scale. |
| Express 5 | Node.js native `http` | Use native `http` only if you want zero dependencies and are comfortable writing raw request parsing. Express's middleware model for static file serving and JSON body parsing saves hours of boilerplate with no meaningful downside here. |
| ws | Socket.IO | Socket.IO auto-reconnect, rooms, and namespaces are genuinely useful for multi-client chat apps. For NanoClaw: single user, single dashboard tab, chat-only realtime need. The overhead and proprietary framing are not worth it. `ws` + `reconnectingWebSocket` (or a 10-line manual reconnect in the client) is sufficient. |
| React Router v7 | TanStack Router | TanStack Router has superior type-safe search params and route tree types. Use it if the dashboard grows to have complex URL-driven state (filtered tables, multi-step workflows). For the current scope (5–8 top-level routes), React Router v7 in library mode is less configuration overhead. |
| TanStack Query v5 | SWR | SWR is simpler for read-only apps. TanStack Query wins here because NanoClaw dashboard has mutations (pause/resume task, clear session, edit CLAUDE.md) which benefit from TanStack Query's mutation state, optimistic updates, and invalidation API. |
| shadcn/ui + Tailwind | MUI (Material UI) | MUI has a better DataGrid for large tables and better official enterprise support. Use MUI if the dashboard needs complex sortable/pageable data grids or if the team wants a pre-designed opinionated design system rather than owning component code. For NanoClaw: Tailwind utility-first is consistent with modern tooling; shadcn/ui components are simpler to customise for a single-user tool. |
| Zustand | React Context | React Context re-renders all consumers on every state change. For a dashboard with sidebar toggles and WebSocket status that update frequently, this causes visible jank. Zustand uses subscriptions with selector equality checks. |
| Vite 8 | Next.js / Remix | Next.js/Remix add SSR, routing conventions, and server components — none of which are needed here. NanoClaw's backend is already Node.js; the frontend is purely a client-side SPA reading from REST/WS. Next.js would add build complexity and framework coupling for zero benefit. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App (CRA) | Unmaintained since 2023, uses Webpack with no HMR performance. Will not work with React 19. | Vite 8 |
| Socket.IO | Adds ~200KB client bundle, proprietary framing, requires Socket.IO client on both ends. Overkill for a single-user chat relay. | `ws` (Node) + native browser `WebSocket` |
| Redux / Redux Toolkit | Significant boilerplate for a single-user tool with simple UI state. TanStack Query already handles server state, leaving almost nothing for Redux to own. | Zustand for UI state, TanStack Query for server state |
| `tailwindcss-animate` | Deprecated in shadcn/ui v4. Replaced by `tw-animate-css`. Using the old package will cause component animation breakage on fresh shadcn/ui v4 installs. | `tw-animate-css` |
| `react-router-dom` (separate package) | React Router v7 merged `react-router-dom` into `react-router`. Installing `react-router-dom` still works (re-exports from `react-router`) but adds an unnecessary package. | `react-router` directly |
| `@vitejs/plugin-react-swc` | SWC-based plugin occasionally lags behind React releases. React 19 Compiler integration is better supported via Babel plugin path (`@vitejs/plugin-react`). | `@vitejs/plugin-react` |
| Axios | No reason to add Axios when TanStack Query's `queryFn` can use native `fetch()`, which is standard in Node.js 22 and all modern browsers. Axios adds bundle weight for no gain. | Native `fetch()` inside TanStack Query `queryFn` |

---

## Stack Patterns by Variant

**For development (hot reload):**
- Vite dev server runs on port 5173 with `server.proxy` routing `/api/*` and `/ws` to Express on port 3000
- Express serves nothing in dev — Vite dev server is the entry point
- TypeScript types for API responses live in `src/shared/types.ts` (symlinked or copied from backend)

**For production:**
- `npm run build` in `dashboard/` outputs to `dashboard/dist/`
- Express serves `dashboard/dist/` via `express.static('dashboard/dist')`
- All `/api/*` routes handled by Express middleware before static fallback
- WebSocket upgrade intercepted on the `http.Server` instance before Express handles it
- SPA fallback: Express sends `index.html` for all unmatched routes (React Router takes over)

**If shared types between frontend and backend are needed:**
- Create `src/shared/` directory at repo root
- Add path alias in both `tsconfig.json` (backend) and `dashboard/vite.config.ts` (`resolve.alias`)
- Keep types pure (no Node.js or browser-specific imports)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| shadcn/ui (CLI v4) | React 19, Tailwind CSS 4.x | shadcn/ui confirmed React 19 + Tailwind v4 support since Feb 2025. Do NOT mix Tailwind v3 components with a v4 setup. |
| `@tailwindcss/vite` | Vite 8, Tailwind 4.x | The Vite plugin replaces both the PostCSS plugin and the `tailwind.config.js`. Do not add PostCSS config when using the Vite plugin. |
| `ws` 8.x | Node.js 22, Express 5 | Attach to `http.Server` via `new WebSocketServer({ server: httpServer })`. Works alongside Express without conflicts. |
| `@tanstack/react-query` 5.x | React 19 | v5 fully supports React 19's concurrent rendering. Use `ReactQueryDevtools` component in dev builds only (`import.meta.env.DEV`). |
| React Router 7.x | React 19 | v7 is built for React 19. No `react-router-dom` needed — import directly from `react-router`. |
| Zustand 5.x | React 19 | v5 dropped deprecated APIs from v4. Uses `useSyncExternalStore` internally, compatible with React 19 concurrent mode. |

---

## Sources

- [Vite 8.0 Official Announcement](https://vite.dev/blog/announcing-vite8) — version confirmation, Rolldown integration, React/TS support
- [React v19 Blog Post](https://react.dev/blog/2024/12/05/react-19) — stable release Dec 2024; React 19.2 Oct 2025
- [shadcn/ui Tailwind v4 Docs](https://ui.shadcn.com/docs/tailwind-v4) — confirmed React 19 + Tailwind v4 compatibility
- [shadcn/ui CLI v4 Changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) — March 2026 CLI release
- [Express 5.1.0 Now npm Default](https://expressjs.com/2025/03/31/v5-1-latest-release.html) — stable status confirmation
- [@types/ws npm](https://www.npmjs.com/package/@types/ws) — v8.18.1, April 2025; ws 8.18.3 current
- [TanStack Query npm](https://www.npmjs.com/package/@tanstack/react-query) — v5.90.21 current
- [React Router npm](https://www.npmjs.com/package/react-router) — v7.13.1 current
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — v4.2.1 current, zero-config install
- [Zustand npm](https://www.npmjs.com/package/zustand) — v5.0.11 current
- [WebSearch: Express vs Fastify 2025](https://betterstack.com/community/guides/scaling-nodejs/fastify-express/) — MEDIUM confidence, comparative analysis
- [WebSearch: ws vs Socket.IO](https://dev.to/alex_aslam/nodejs-websockets-when-to-use-ws-vs-socketio-and-why-we-switched-di9) — MEDIUM confidence, use-case analysis
- [WebSearch: shadcn/ui vs MUI 2025](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra) — MEDIUM confidence, ecosystem comparison

---

*Stack research for: NanoClaw Dashboard — React + Vite SPA on Node.js/TypeScript backend*
*Researched: 2026-03-15*
