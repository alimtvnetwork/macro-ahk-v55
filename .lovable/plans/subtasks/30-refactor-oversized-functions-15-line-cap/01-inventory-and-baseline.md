---
Slug: inventory-and-baseline
Status: completed
Created: 2026-07-20
Completed: 2026-07-20
Parent: 30-refactor-oversized-functions-15-line-cap
---

# SS-01 Inventory and baseline (results)

## Method

Ran ESLint with a scratch config (`/tmp/eslint-15.config.mjs`) that extends the repo config and applies `max-lines-per-function: { max: 15, skipBlankLines: true, skipComments: true, IIFEs: true }` across `src/**/*.{ts,tsx}` and `standalone-scripts/**/*.{ts,tsx}`. Full JSON output at `/tmp/eslint-15.json`; human-readable inventory committed to `.lovable/tmp/lint-15-inventory.txt` (11 MB JSON, ~4k offender lines).

## Baseline totals

- Offenders (functions > 15 lines): **3,796**
- Files with at least one offender: **1,236**
- Repos in scope: `src/` and `standalone-scripts/`.

## Top 15 hotspots (offenders per file)

| Count | File |
| ----- | ---- |
| 32 | `standalone-scripts/macro-controller/src/ui/prompt-library-modal.ts` |
| 28 | `standalone-scripts/macro-controller/src/ui/settings-tab-panels.ts` |
| 26 | `standalone-scripts/macro-controller/src/ui/prompt-history-panel.ts` |
| 23 | `src/lib/sqlite-bundle.ts` |
| 22 | `src/background/recorder/__tests__/instruction-failure-adapters.test.ts` |
| 22 | `standalone-scripts/macro-controller/src/startup.ts` |
| 22 | `standalone-scripts/macro-controller/src/ws-members-panel.ts` |
| 19 | `standalone-scripts/macro-controller/src/ui/projects-modal.ts` |
| 18 | `standalone-scripts/macro-controller/src/ui/credit-totals-modal.ts` |
| 18 | `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts` |
| 18 | `standalone-scripts/macro-controller/src/ui/repeat-loop-ui.ts` |
| 17 | `src/background/recorder/step-library/export-bundle.ts` |
| 17 | `src/background/recorder/step-library/run-group-runner.ts` |
| 17 | `standalone-scripts/macro-controller/src/ui/prompt-utils.ts` |
| 16 | `src/background/recorder/step-library/import-bundle.ts` |

## Cluster analysis

1. `standalone-scripts/macro-controller/src/ui/*` — UI modals, dropdowns, and panels: ~180 offenders across 15 files. Refactor pattern = Shell + Wire + A11y + Teardown (SS-02 pattern 1).
2. `src/background/recorder/**` — recorder UI mounts + async step executors + selector helpers: covers every file called out in `issues/open/10-*` (dropzone-overlay, hover-highlighter, http-request-step, live-dom-replay, recorder-toolbar, selector-*). Pattern = async pipeline (SS-02 pattern 2) + guard clauses (pattern 3).
3. `src/background/recorder/step-library/**` — bundle import/export + group runner: 50+ offenders. Pattern = table dispatch (SS-02 pattern 5) + config-object params (pattern 4).
4. `src/lib/sqlite-bundle.ts` and adjacent shared libs: 23 offenders. Pattern = extract per-statement helpers.
5. Tests (`__tests__/`): ~400 offenders. Pattern = `arrange/act/assert` helper extraction (SS-05 point 5).

## Refactor sequencing (feeds Plan 30 Steps 6-9)

- Step 6 (live-dom-replay) — covered in SS-03; hotspot rank 4-5 by cognitive complexity.
- Step 7 (recorder toolbar + overlays) — SS-04; ~30 offenders across the three files.
- Step 8 (http step + selectors + logging-handler test) — SS-05; ~40 offenders.
- Step 9 (long tail) — the remaining 1.2k+ files clustered in `ui/*`, `step-library/*`, `sqlite-bundle.ts`, tests. Split into micro-PRs by folder to keep review surface small.

## Risk callouts

- Volume (3,796 offenders) is far larger than the truncated lint excerpt suggested. Plan 30 Step 12 (root-config tightening to 15 lines) MUST land AFTER the bulk refactor, not before, or CI will red for weeks. Recommend a staged rollout: enforce 15 lines per folder as each folder is cleaned, then flip repo-wide.
- Some offenders are generated code / vendor bundles (verify during Step 9); exclude via ESLint `ignores` rather than refactor.
- Test files at 15 lines is aggressive; if it causes churn without value we will ask the user to confirm the test-file exemption (currently disallowed by command 06).

## Artifacts

- `/tmp/eslint-15.json` — raw ESLint JSON (not committed).
- `.lovable/tmp/lint-15-inventory.txt` — human-readable per-file listing (not committed by policy; regenerate on demand).
- Scratch config: `/tmp/eslint-15.config.mjs`.

## Exit criteria

Met: every offender is enumerated with file + line + message; hotspots ranked; refactor sequencing mapped to Plan 30 Steps 6-9; risk callouts recorded. Proceed to SS-02 (patterns catalog) confirmation, then Step 3 (memory tightening) next turn.
