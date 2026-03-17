---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` (root) — includes `src/**/*.test.ts` |
| **Quick run command** | `npm test -- --run src/dashboard/server.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/dashboard/server.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | INFRA-01, INFRA-03, INFRA-04, INFRA-05 | unit | `npm test -- --run src/dashboard/server.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INFRA-01 | unit | `npm test -- --run src/dashboard/server.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | INFRA-03 | unit | `npm test -- --run src/dashboard/server.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | INFRA-04 | unit | `npm test -- --run src/dashboard/server.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | INFRA-05 | unit | `npm test -- --run src/dashboard/server.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 1 | INFRA-02 | unit | `npm test -- --run src/dashboard/server.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | INFRA-06 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/dashboard/server.test.ts` — stubs for INFRA-01 through INFRA-05 using Vitest + supertest
- [ ] `npm install -D supertest @types/supertest` — HTTP assertion library (not currently in project)

*Wave 0 must be completed before Wave 1 tasks execute.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vite dev proxy forwards `/api` and `/ws` to backend | INFRA-06 | Requires two live processes (Vite dev server + NanoClaw backend); cannot be tested in-process | 1. Start NanoClaw: `npm run dev` in root. 2. Start Vite: `cd dashboard && npm run dev`. 3. Run `curl http://localhost:5173/api/health` — expect `{"ok":true}`. 4. Open browser console, run `new WebSocket('ws://localhost:5173/ws/chat')` — expect connection upgrade (not 426). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
