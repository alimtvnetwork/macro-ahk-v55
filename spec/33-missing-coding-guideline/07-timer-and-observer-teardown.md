# 07 - Timer & Observer Teardown Audit

**Plan-16 · Task 9 · v4.83.0 · 2026-07-17**

Scope: `standalone-scripts/**` production `.ts` (excludes `**/__tests__/**`, `**/dist/**`, `**/node_modules/**`).

Rule sources:
- `mem://standards/timer-and-observer-teardown` — every `setInterval` / `setTimeout` / `MutationObserver` / `addEventListener` MUST have a paired teardown, plus a `pagehide` unwind, and tick UIs MUST pause on `document.hidden`.
- `mem://performance/idle-loop-audit-2026-04-25` — canonical clear path is `trackedSetInterval` / `trackedClearInterval` from `macro-controller/src/interval-registry.ts`.
- `mem://constraints/no-retry-policy` — reinstall loops must be bounded (finite backoff, sequential fail-fast).

## Methodology (deterministic, re-runnable)

```bash
cd standalone-scripts
rg -n --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' '\bsetInterval\('
rg -n --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' '\bclearInterval\('
rg -n --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' 'new MutationObserver'
rg -n --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' '\.disconnect\(\)'
rg -c --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' 'addEventListener\('
rg -c --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' 'removeEventListener\('
rg -n --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' 'pagehide'
```

## Denominators

| Signal | Count |
|---|---|
| `setInterval(` production sites | 13 (across 11 files) |
| `clearInterval(` production sites | 12 (across 7 files) |
| `new MutationObserver` production sites | 7 |
| `.disconnect()` production sites | 7 |
| `addEventListener(` occurrences (production) | 143 |
| `removeEventListener(` occurrences (production) | 48 |
| `pagehide` handlers (production) | 4 files |

## Finding T-1 - `setInterval` bypassing the tracked registry (P0)

`interval-registry.ts` exists specifically as the canonical clear path (see `mem://performance/idle-loop-audit-2026-04-25`). It is imported by 11 modules, but **11 raw `setInterval(` sites still bypass it**:

| File | Line | Label to use |
|---|---|---|
| `marco-sdk/src/utils.ts` | 242 | `MarcoSdk.utils.entry` |
| `marco-sdk/src/notify.ts` | 175 | `MarcoSdk.notify.dedup` |
| `macro-controller/src/core/LoopEngine.ts` | 38 | `LoopEngine.cycle` (method name, safe) |
| `macro-controller/src/core/MacroController.ts` | 75 | interface declaration (not a call site, exclude) |
| `macro-controller/src/loop-move-gate.ts` | 30 | `LoopMoveGate.poll` |
| `macro-controller/src/loop-run-state/index.ts` | 78 | `LoopRunState.poll` |
| `macro-controller/src/ui/macro-ui.ts` | 200 | `MacroUi.refresh` |
| `macro-controller/src/ui/macro-ui.ts` | 203 | `MacroUi.aux` |
| `macro-controller/src/ui/task-splitter-ui.ts` | 566 | `TaskSplitterUi.tick` |
| `macro-controller/src/ui/prompt-utils.ts` | 484 | `PromptUtils.tick` |
| `macro-controller/src/ui/repeat-loop-ui.ts` | 593 | `RepeatLoopUi.tick` |

Effective P0 (raw call sites, excluding the interface declaration): **10 sites**.

Impact: `api.metrics.intervals()` under-reports live intervals, so the leak canary designed by the 2026-04-25 audit cannot detect regressions in these paths. `macro-ui.ts:200-203` in particular starts two unlabelled 1 s tickers with no paired `clearInterval` in the same module.

Remediation: swap each raw `setInterval` for `trackedSetInterval(label, cb, ms)` and each `clearInterval(h)` for `trackedClearInterval(h)`. No behaviour change; only observability.

## Finding T-2 - Tickers with no paired `clearInterval` in the same module (P0)

Files with `setInterval` but zero `clearInterval` in the same file:

- `marco-sdk/src/utils.ts` (1 set / 1 clear - OK)
- `marco-sdk/src/notify.ts` (1 set / 1 clear - OK)
- `macro-controller/src/ui/macro-ui.ts` - **2 set / 0 clear** ← P0 leak candidate.
- `macro-controller/src/ui/prompt-utils.ts` - **1 set / 0 clear** ← P0.
- `macro-controller/src/core/LoopEngine.ts` - **1 set / 0 clear** ← P1 (owned by `MacroController` teardown).

Impact: If the SPA rehydrates the panel without a full reload, orphaned tickers accumulate and each new instance stacks another 1 s callback on top. The `document.hidden` pause requirement from the memory is also unenforceable when the caller can't reach the handle.

Remediation:
1. Route all three files through `trackedSetInterval` + store the handle at module scope.
2. Add `pagehide` teardown that calls `trackedClearInterval(handle)`.
3. Wrap the tick body in `if (document.hidden) return;` per memory rule.

## Finding T-3 - `MutationObserver` sites without `pagehide` teardown (P1)

All 7 MutationObserver instances hold a `.disconnect()` (parity 7/7), but only 2 wire the disconnect through a `pagehide` listener:

| File | Observer | `.disconnect()` present | `pagehide` wired |
|---|---|---|---|
| `payment-banner-hider/src/index.ts:135` | scheduleCheck | ✓ | ✗ |
| `lovable-dashboard/src/index.ts:66` | scheduleRebuild | ✓ | ✗ |
| `macro-controller/src/workspace-observer.ts:286` | ws mutations | ✓ (3x) | ✗ |
| `macro-controller/src/startup-persistence.ts:108` | persistence | ✓ | ✗ |
| `macro-controller/src/ui/next-inline-ui.ts:430` | next chip | ✓ | ✗ |
| `macro-controller/src/ui/payment-notice-removal.ts:178` | payment notice | ✓ | ✗ |
| `macro-controller/src/ui/repeat-loop-ui.ts:647` | repeat inline | ✓ | ✗ |

Impact: On SPA route change (Lovable dashboard rebinds `<body>` subtree) the observers keep firing against stale nodes until `.disconnect()` is called from an event that never triggers on soft navigation. `pagehide` is the required belt-and-braces per memory.

Remediation: Add a single shared helper (e.g. `standalone-scripts/macro-controller/src/utils/observer-lifecycle.ts`) that returns `{ observer, teardown }` and registers `window.addEventListener('pagehide', teardown, { once: true })`.

## Finding T-4 - `addEventListener` / `removeEventListener` parity gap (P1)

Global count: **143 add / 48 remove**. Net **95 listeners** with no matching removal in production code. Even accounting for handlers deliberately attached for extension lifetime, the ratio (2.98:1) is far above the recorder/replay memory tolerance for "single-lifetime" handlers (target ≤ 1.3:1 outside the boot phase).

Highest-density files (add count):
- `macro-controller/src/ui/prompt-library-modal.ts` (many add, matched removes via `pagehide` cleanup - compliant pattern to copy).
- `macro-controller/src/ui/ws-hover-card.ts`, `ui/prompt-import-modal.ts`, `ui/settings-tab-panels.ts` - long-lived listeners without teardown.

Remediation: Adopt the `prompt-library-modal.ts` pattern (stash the handler on the root element, remove on close and on `pagehide`). Not a blanket rewrite: prioritise files that live inside modals or route-scoped panels.

## Finding T-5 - `pagehide` coverage below rule (P1)

Only **4 files** use `pagehide`:
- `macro-controller/src/ui/prompt-library-modal.ts` (compliant).
- `macro-controller/src/spa-route-guard.ts` (compliant, this is the helper file).
- Two doc-comment mentions.

Memory requires every timer/observer owner to have a `pagehide` unwind. Effective coverage vs. owners: **2 / 18 ≈ 11 %**.

## Backlog rollup

| ID | Severity | Where | Effort |
|---|---|---|---|
| T-1 | P0 | 10 `setInterval` sites | 1 h (mechanical swap) |
| T-2 | P0 | `macro-ui.ts` (2 tickers), `prompt-utils.ts` (1) | 45 min |
| T-3 | P1 | 7 MutationObserver files | 45 min (shared helper) |
| T-4 | P1 | Modal/panel listeners without teardown | 2 h |
| T-5 | P1 | Add `pagehide` unwind to timer/observer owners | Folds into T-2/T-3 |

No source-code changes in this release. Remediation lives in follow-up commits per the audit-first methodology stated in `spec/33-missing-coding-guideline/readme.md`.
