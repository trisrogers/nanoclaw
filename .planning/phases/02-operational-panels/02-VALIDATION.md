---
phase: 2
slug: operational-panels
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test 2>&1 \| tail -5` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test 2>&1 | tail -5`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | OVER-01 | unit | `npm test -- src/dashboard/routes/stats.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | OVER-01 | unit | `npm test -- src/dashboard/routes/stats.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | OVER-02 | manual | n/a — client-side interval | n/a | ⬜ pending |
| 2-01-04 | 01 | 1 | GRP-01 | unit | `npm test` (existing) | ✅ | ⬜ pending |
| 2-01-05 | 01 | 1 | GRP-02 | unit | `npm test -- src/dashboard/routes/channels.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 0 | OPS-01 | unit | `npm test -- src/dashboard/routes/containers.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | OPS-01 | unit | `npm test -- src/dashboard/routes/containers.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | OPS-02 | unit | `npm test -- src/dashboard/routes/containers.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 1 | OPS-03 | unit | `npm test -- src/dashboard/routes/containers.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 0 | OPS-04 | unit | `npm test -- src/dashboard/routes/logs.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 1 | OPS-04 | unit | `npm test -- src/dashboard/routes/logs.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 1 | OPS-05 | manual | n/a — 5s client-side interval | n/a | ⬜ pending |
| 2-04-01 | 04 | 0 | CHAT-01 | unit | `npm test -- src/dashboard/chat-handler.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-02 | 04 | 1 | CHAT-01 | unit | `npm test -- src/dashboard/chat-handler.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-03 | 04 | 1 | CHAT-02 | integration | `npm test -- src/dashboard/chat-handler.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-04 | 04 | 1 | CHAT-03 | unit | `npm test -- src/dashboard/chat-handler.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-05 | 04 | 1 | CHAT-04 | unit | `npm test -- src/dashboard/chat-handler.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/dashboard/routes/stats.test.ts` — stubs for OVER-01
- [ ] `src/dashboard/routes/containers.test.ts` — stubs for OPS-01, OPS-02, OPS-03
- [ ] `src/dashboard/routes/logs.test.ts` — stubs for OPS-04
- [ ] `src/dashboard/routes/channels.test.ts` — stubs for GRP-02
- [ ] `src/dashboard/chat-handler.test.ts` — stubs for CHAT-01, CHAT-02, CHAT-03, CHAT-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auto-refresh every 10s (overview) | OVER-02 | Client-side interval, not unit-testable without browser | Open dashboard, watch network tab for `/api/stats` calls every 10s |
| Log panel 5s auto-refresh | OPS-05 | Client-side interval | Open log panel, verify new logs appear every ~5s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
