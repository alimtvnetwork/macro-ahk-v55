# SS-01, Migration manifest

Slug: migration-manifest
Parent: 27-legacy-throw-migration
Status: complete (Plan 27 steps 1 and 2)
Created: 2026-07-19
Completed: 2026-07-19 (v4.266.0)

## Purpose

Authoritative table of every `throw new Error(...)` site in `standalone-scripts/macro-controller/src/` that must be drained by Plan 27 steps 4 to 13, plus every site that stays exempt forever (test simulations and the taxonomy itself).

## Root cause (one sentence)

Plan 26 shipped `DiagnosticError` with a per-area migration allowlist, but the allowlist was never enumerated as a checklist, so nobody could tell which files were "waiting" vs "permanently exempt" without re-running ripgrep, and steps 3 to 13 had no ordered work queue.

## Data sources

1. `rg -l "throw new Error" standalone-scripts/macro-controller/src/` (56 files, 2026-07-19).
2. `standalone-scripts/macro-controller/src/errors/__tests__/per-area-migration-coverage.test.ts` (migrated-modules list at time of writing: 13 files, none of which appear below).
3. `standalone-scripts/macro-controller/src/errors/error-codes.ts` (registry) for suggested target-area names.

Every file below is currently NOT in the migrated-modules list, meaning it bypasses the DiagnosticError contract.

## PROD files, must migrate (25 files, 66 throw sites)

Ordered by Plan 27 step assignment. Column "Sites" is the count from ripgrep on 2026-07-19.

| # | File | Sites | Suggested area(s) | Target Plan 27 step |
|---|------|------:|-------------------|---------------------|
|  1 | `src/credit-fetch.ts`                     | 6 | CREDIT, SDK, HTTP, AUTH | Step 4 |
|  2 | `src/credit-api.ts`                        | 1 | CREDIT                  | Step 5 |
|  3 | `src/remix-fetch.ts`                       | 6 | REMIX, SDK, HTTP        | Step 6 |
|  4 | `src/remix-bulk.ts`                        | 3 | REMIX, SDK, HTTP        | Step 6 |
|  5 | `src/remix-name-resolver.ts`               | 2 | REMIX                   | Step 6 |
|  6 | `src/ws-members-fetch.ts`                  | 2 | WORKSPACE, SDK, HTTP    | Step 7 |
|  7 | `src/ws-members-mutations.ts`              | 9 | WORKSPACE, SDK, HTTP    | Step 7 |
|  8 | `src/ws-adjacent.ts`                       | 2 | WORKSPACE, SDK, HTTP    | Step 7 |
|  9 | `src/rename-api.ts`                         | 2 | RENAME, HTTP            | Step 8 |
| 10 | `src/settings-store.ts`                     | 1 | SETTINGS                | Step 8 |
| 11 | `src/settings-modal.ts`                     | 1 | SETTINGS (validation)   | Step 9 |
| 12 | `src/ui/projects-modal.ts`                  | 2 | UI, REMIX               | Step 9 |
| 13 | `src/ui/section-open-tabs.ts`               | 1 | UI (clipboard fallback) | Step 9 |
| 14 | `src/ui/task-splitter-prompt.ts`            | 3 | SPLITTER                | Step 9 |
| 15 | `src/ui/template-renderer.ts`               | 1 | TEMPLATE                | Step 9 |
| 16 | `src/ui/prompt-import-audit.ts`             | 2 | PROMPT_IO               | Step 9 |
| 17 | `src/ui/prompt-import-modal.ts`             | 1 | PROMPT_IO               | Step 9 |
| 18 | `src/ui/prompt-io-format-detect.ts`         | 1 | PROMPT_IO               | Step 9 |
| 19 | `src/ui/prompt-io-sqlite-reader.ts`         | 5 | PROMPT_IO               | Step 9 |
| 20 | `src/ui/prompt-io-zip-reader.ts`            | 7 | PROMPT_IO               | Step 9 |
| 21 | `src/queue-control/task-queue.ts`           | 1 | QUEUE                   | Step 10 |
| 22 | `src/loop-cycle-fallback.ts`                | 2 | LOOP, SDK, HTTP         | Step 10 |
| 23 | `src/gitsync/progress-probe.ts`             | 3 | GITSYNC, HTTP           | Step 11 |
| 24 | `src/pro-zero/pro-zero-sdk-adapter.ts`      | 1 | PROZERO, SDK            | Step 12 |
| 25 | `src/async-utils.ts`                         | 1 | ASYNC (new area)        | Step 13 |
| 26 | `src/types/prompt-role.ts`                   | 1 | TYPE (exhaustiveness)   | Step 13 (or exempt, see note) |

PROD subtotal: 26 files, 67 sites.

Note on `src/types/prompt-role.ts` (site count 1): the throw is a TypeScript exhaustiveness check (`assertNever`-style) in a helper. Two acceptable resolutions during step 13:
- (A) Replace with a dedicated `TYPE_EXHAUSTIVE_E001` code so the guarantee is uniform.
- (B) Move the throw to a shared `assertNever(x): never` helper in `errors/` and add that helper to the permanent-exemption list.
Decision to be recorded on the step-13 PR.

## TEST-SIM, permanent exemption (23 files)

Every file below is under a `__tests__/` directory. Throws simulate upstream failures (SDK returning bad shapes, DB rejecting writes, HTTP 500 responses, etc.) and MUST stay as `throw new Error(...)` to keep the tests readable and independent of the taxonomy. Each throw already reads as an inline synthetic failure; no migration.

- `src/__tests__/chat-submit-opfs-store.test.ts`
- `src/__tests__/credit-enrichment-fanout.test.ts`
- `src/__tests__/credit-fetch-failure-schema.test.ts`
- `src/__tests__/js-executor.test.ts`
- `src/__tests__/multi-workspace-unified-billing-fanout-e2e.test.ts`
- `src/__tests__/open-tabs-probe-responder.test.ts`
- `src/__tests__/remix-invalidate-sentinel.test.ts`
- `src/__tests__/visible-workspaces-store.test.ts`
- `src/__tests__/ws-move-post-refresh.test.ts`
- `src/db/__tests__/prompt-token-guard.test.ts`
- `src/queue-control/__tests__/auto-resume.test.ts`
- `src/seed/__tests__/prompt-health-auto-repair.test.ts`
- `src/seed/__tests__/prompt-health-check.test.ts`
- `src/seed/__tests__/seed-plan-next-edges.test.ts`
- `src/ui/__tests__/chip-gear-repair-action.test.ts`
- `src/ui/__tests__/database-data-table-log-error.test.ts`
- `src/ui/__tests__/plan-task-ui-db-empty.test.ts`
- `src/ui/__tests__/plan-task-ui-positive.test.ts`
- `src/ui/__tests__/prompt-history-panel-a11y.test.ts`
- `src/ui/__tests__/prompt-io-progress.test.ts`
- `src/ui/__tests__/prompt-library-modal-delete-then-save-drift.test.ts`
- `src/ui/__tests__/prompt-library-modal-drop-failure-banner-focus.test.ts`
- `src/ui/__tests__/prompt-library-modal-import-failure-recovery.test.ts`
- `src/ui/__tests__/prompt-library-modal-import-file-input-reset.test.ts`
- `src/ui/__tests__/task-next-ui-dispatch-submit-branches.test.ts`
- `src/ui/__tests__/task-next-ui-dispatch-submit.test.ts`
- `src/ui/__tests__/task-next-ui-settings-io.test.ts`
- `src/util/__tests__/project-id-from-url.test.ts`

Enforcement: Plan 27 step 16 tightens `no-restricted-syntax` for bare `throw new Error(...)` to `standalone-scripts/macro-controller/src/**` with a glob-exempt `src/**/__tests__/**` so these files stay valid without per-file annotations.

## TAXONOMY, permanent exemption (2 files)

These files ARE the DiagnosticError implementation. They must be allowed to throw with their own inline codes.

| File | Notes |
|------|-------|
| `src/errors/diagnostic-error.ts` | ripgrep hit is a comment string, not a throw; keep exempt in perpetuity. |
| `src/errors/format.ts`           | 3 throws are formatter-internal validation (`[DIAGNOSTIC_META_E001]`, etc.); allowed to stay as raw `throw new Error` because they precede the taxonomy that would wrap them. |

## Verification signals for downstream steps

- Step 3 (code reservation) is complete when every PROD row above has at least one reserved `E<NNN>` code in `error-codes.ts` and `check-error-codes-unique.mjs` passes.
- Steps 4 to 13 each remove the migrated file(s) from the effective allowlist by adding them to `MIGRATED_MODULES` in `per-area-migration-coverage.test.ts`; a PR is not mergeable until the corresponding row here is struck through.
- Step 15 flips the invariant so PROD files not listed above will fail CI even if they compile (no more silent regressions).

## Change log for this subtask

- 2026-07-19 v4.266.0: initial enumeration and classification landed. 26 PROD files, 28 TEST-SIM files, 2 TAXONOMY files. No code changes yet, this is planning-only per Plan 27 steps 1 and 2.
