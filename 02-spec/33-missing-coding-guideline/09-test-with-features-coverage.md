# 09 - Test-with-features Coverage Gap Map

**Plan-16 · Task 11 · v4.84.0 · 2026-07-17**

Scope: `standalone-scripts/**` (excludes `**/dist/**`, `**/node_modules/**`).

Rule sources:
- `mem://preferences/test-with-features` (Core) - every new feature/fix ships with matching tests (unit, component, or E2E).
- `mem://preferences/deferred-workstreams` - manual Chrome E2E and React component test bans were LIFTED 2026-05-25; there are no remaining excuses to skip tests.

## Methodology (deterministic, re-runnable)

```bash
cd standalone-scripts
find . -type f -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' \
  -not -path '*/__tests__/*' -not -name '*.test.ts' -not -name '*.spec.ts' \
  -not -name '*.d.ts' | wc -l
find . -type f \( -name '*.test.ts' -o -name '*.spec.ts' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' | wc -l
ls ../tests/e2e/*.spec.ts | wc -l
```

## Denominators

| Package | Prod `.ts` | Test files | Ratio | Rating |
|---|---|---|---|---|
| `macro-controller` | 309 | 168 | **0.54** | Best in repo |
| `payment-banner-hider` | 7 | 2 | 0.29 | Acceptable |
| `lovable-dashboard` | 15 | 2 | 0.13 | Low |
| `lovable-owner-switch` | 47 | 5 | 0.11 | Low |
| `lovable-user-add` | 44 | 4 | 0.09 | Low |
| `lovable-common` | 33 | 0 | **0.00** | **Zero coverage** |
| `marco-sdk` | 20 | 0 | **0.00** | **Zero coverage** |
| `xpath` | 6 | 0 | **0.00** | **Zero coverage** |
| **Total** | **508** | **181** | **0.36** | - |

Plus `tests/e2e/*.spec.ts`: **57 Playwright specs** (all currently living outside `standalone-scripts/`, largely covering macro-controller and workspace flows).

## Finding TC-1 - Three packages at 0.00 test ratio (P0)

`marco-sdk` (20 prod files), `lovable-common` (33 prod files), and `xpath` (6 prod files) have **zero** local test files. This is a hard breach of the Core `test-with-features` rule.

- **`marco-sdk`** hosts `getBearerToken()`, HTTP wrappers, notify, self-namespace, self-test - the exact surface that `mem://auth/unified-auth-contract` says is the single canonical auth path. Any regression here breaks the extension globally and has no unit-level canary.
- **`lovable-common`** hosts shared DOM helpers imported by every other package. A silent bug propagates to 7 packages.
- **`xpath`** hosts the recorder's XPath generator, referenced by `e2e-20`, `e2e-21`, `e2e-22` E2E specs. E2E-only coverage means every regression costs one full browser run to detect.

Impact: `mem://preferences/test-with-features` cannot be enforced by CI on 59 production files (~11.6 % of the repo).

Remediation priority order: `marco-sdk/src/auth-token-utils.ts` (auth-critical) → `lovable-common/src/dom-utils.ts` (fan-out multiplier) → `xpath/src/*` (recorder correctness).

## Finding TC-2 - `macro-controller/src/ui/` untested surface (P1)

101 `.ts` files under `ui/`; 15 have matching `__tests__/*.test.ts` files. Coverage ratio for the UI layer: **0.15** (well below the package average of 0.54, because `db/`, `core/`, and utility folders pull the aggregate up).

Notable untested UI files with recent behavioural changes visible in recent changelog entries:

| File | LOC | Last-touched surface (from changelog) |
|---|---|---|
| `prompt-dropdown.ts` | 1441 | Plan-15 (chip resolvers, DB bridge) |
| `projects-modal.ts` | 1114 | v3.12/v3.31 workspace-badge + credit-totals |
| `settings-tab-panels.ts` | 901 | v4.52 editor-text integration |
| `error-overlay.ts` | 802 | Real-time error sync memory |
| `task-splitter-ui.ts` | 727 | Plan-15 configured-chip-values consumer |
| `bulk-rename.ts` | 707 | Rename presets memory |
| `credit-totals-modal.ts` | 703 | v3.31 FREE-tier exclusion |
| `repeat-loop-ui.ts` | 655 | User request 2026-07-17 (repeat presets) |
| `macro-ui.ts` | 600 | 2 unlabelled setInterval (T-1/T-2 in report 07) |
| `task-next-ui.ts` | 563 | Configured chip values |

**Repeat-loop-ui presets** landed as a direct user request this session with **no accompanying test** despite `repeat-loop-presets.test.ts` existing (test file covers a different concern - preset serialisation, not the newly added `10/12/15/20/60/75/80/100/200` values).

## Finding TC-3 - Test-with-features rule breach: repeat-loop presets (P0)

User request (this session, 2026-07-17): add `1, 2, 3, 4, 10, 12, 15, 20, 60, 75, 80, 100, 200` values to Repeat section presets. Change landed in `standalone-scripts/macro-controller/src/ui/repeat-loop-ui.ts` without adding or extending a test that asserts these specific values render as clickable presets.

Existing `repeat-loop-presets.test.ts` covers preset **plumbing** but does not lock the **value set**. A future refactor could drop `200` silently. Concrete breach of `mem://preferences/test-with-features`.

Remediation: extend `repeat-loop-presets.test.ts` (or add `repeat-loop-preset-values.test.ts`) with a table-driven assertion over the expected `readonly REPEAT_PRESETS` array.

## Finding TC-4 - E2E-only surfaces (P2)

E2E specs cover surfaces that also deserve unit-level protection because E2E runs are 10-100× slower than unit tests:

- `e2e-credit-balance-*.spec.ts` (3 specs) → underlying `credit-api.ts` has no unit test (also flagged as P0 in report 06 for `console.error`).
- `e2e-13-backoff.spec.ts` → no-retry-policy logic in `async-utils.ts` has partial unit coverage but not the backoff bounds.
- `e2e-24-cross-project-sync.spec.ts` → workspace-observer.ts has no unit test despite hosting a MutationObserver flagged in report 07.

Not a hard breach (E2E does count for the test-with-features rule), but a resilience gap.

## Finding TC-5 - Test-with-features tooling gap (P1)

There is no CI check that measures "was a `*.test.ts` touched in the same PR as a prod `.ts`". Every one of TC-1/TC-2/TC-3 could reappear in the next feature PR without automated pushback.

Remediation: a small `scripts/check-test-with-features.mjs` that, given a git diff, fails when a `standalone-scripts/**/src/**/*.ts` file changes without a same-package `*.test.ts` change or a `tests/e2e/*.spec.ts` change. Deferred to the "companion ESLint/tsc rule additions" task.

## Backlog rollup

| ID | Severity | Where | Effort |
|---|---|---|---|
| TC-3 | P0 | `repeat-loop-ui.ts` preset value assertion | 20 min |
| TC-1 | P0 | Zero-coverage packages (`marco-sdk`, `lovable-common`, `xpath`) | 3-5 h (spread) |
| TC-2 | P1 | `macro-controller/src/ui/` 86 untested files, top 10 by recency | 4-6 h |
| TC-5 | P1 | `check-test-with-features.mjs` CI guard | 1 h |
| TC-4 | P2 | Unit shadows for E2E-only surfaces (credit, backoff, ws-observer) | 2 h |

No source-code changes in this release (audit-only).
