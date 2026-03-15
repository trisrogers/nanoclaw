---
phase: 3
slug: data-panels
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing in dashboard) + supertest for routes |
| **Config file** | `src/dashboard/vitest.config.ts` (if exists) or inline |
| **Quick run command** | `npm run build` (TypeScript compilation check) |
| **Full suite command** | `npm run build && cd src/dashboard && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && cd src/dashboard && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | MSG-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | MSG-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | MSG-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | MEM-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | MEM-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | MEM-03 | manual | see manual table | N/A | ⬜ pending |
| 3-03-01 | 03 | 1 | TASK-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 1 | TASK-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 1 | TODO-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-04-02 | 04 | 1 | TODO-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-05-01 | 05 | 2 | USAGE-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-05-02 | 05 | 2 | USAGE-02 | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] TypeScript build passes before any panel code is written
- [ ] `src/dashboard/src/components/` directory confirmed to exist

*Existing infrastructure covers all phase requirements — no new test framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Unsaved changes warning on nav | MEM-03 | Browser event (`beforeunload`) + React prop callback cannot be unit tested | Open editor, type a change, click a sidebar nav item — confirm dialog appears |
| Chat bubble layout (visual) | MSG-01 | Visual alignment (left/right bubbles) requires browser rendering | Load message history panel in browser, verify user messages right-aligned, bot messages left-aligned |
| Usage CLI parsing | USAGE-01 | `claude /usage` output format is undocumented — parser must be verified against real CLI | Run `claude /usage` manually, verify dashboard renders the values correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
