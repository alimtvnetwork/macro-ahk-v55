# 10 - Cognitive-complexity & max-lines-per-function Hotspot Ranking

**Plan-16 · Task 12 · v4.84.0 · 2026-07-17**

Scope: `standalone-scripts/**` production `.ts` (excludes `**/__tests__/**`, `**/dist/**`, `**/node_modules/**`, `*.d.ts`).

Rule sources:
- `eslint.config.js:55-56` - `sonarjs/cognitive-complexity: ["warn", 15]`.
- `eslint.config.js:110`, `:391`, `:399`, `:410`, `:419` - `max-lines-per-function` varies by package/directory: 40 (recorder), 50 (default and options), 60 (macro-controller UI).
- `eslint.config.js:326`, `:384` - **rule OFF** for `standalone-scripts/**` main tree and for a specific override zone. This is the audit-critical loophole.
- `mem://architecture/linting-policy` - zero warnings at `--max-warnings=0`, but only inside enabled zones.

## Methodology (deterministic, re-runnable)

```bash
npx eslint standalone-scripts --format=json > /tmp/eslint.json
node -e 'const d=require("/tmp/eslint.json"); ...'   # extract by ruleId
# File-level LOC ranking (proxy when eslint is disabled)
find standalone-scripts -type f -name '*.ts' -not -path '*/__tests__/*' \
  -not -name '*.test.ts' -not -name '*.spec.ts' -not -name '*.d.ts' \
  -not -path '*/dist/*' -not -path '*/node_modules/*' -exec wc -l {} + \
  | sort -nr | head -25
```

## Denominators

- ESLint `--max-warnings=0` on `standalone-scripts/**` currently: **0 warnings, 0 errors** (Plan-15 refactors held).
- Cognitive-complexity warnings surfaced: **0**.
- max-lines-per-function warnings surfaced: **0**.
- Prod files > 500 LOC: **20** (see table below).
- Prod files > 700 LOC: **12**.
- Prod files > 1000 LOC: **3**.
- Total prod LOC: 72 621 across 508 files (mean 143 LOC/file).

The zero-warning number is misleading: `eslint.config.js:326` disables `max-lines-per-function` for the `standalone-scripts/**` block, and `:384` disables it in a further override. The tightest active caps (40/50/60 LOC per function) are enforced only in **recorder-adjacent** and **options-page** globs. See Finding CX-1.

## Finding CX-1 - `max-lines-per-function` is OFF for the entire `standalone-scripts/**` tree (P0)

`eslint.config.js:326` (block: `files: ["standalone-scripts/**/*.ts"]`) explicitly disables `max-lines-per-function`. Plan-16 step 4 (`spec/33-missing-coding-guideline/02-cross-language-style.md`) already noted this as a package-scoping gap for `no-restricted-identifiers`; the same class of scoping failure applies here.

Impact:
- Reports 07 and 08 both cited files where a single function likely exceeds 60 LOC (`macro-ui.ts` tick setup, `prompt-dropdown.ts` builders) but ESLint stays silent.
- The Plan-15 refactor of `prompt-library-modal.ts` was **manually** driven ("Refactored `prompt-library-modal.ts` to resolve ESLint `max-lines-per-function` warnings" per earlier turn), which contradicts the ESLint-clean baseline unless a **different** override enabled the rule for that specific file. Either way the coverage is inconsistent.

Root cause (one sentence): the `standalone-scripts/**` override at `eslint.config.js:326` was added when the package was a green-field vendor drop and was never rescoped after the tree grew to 508 files.

Remediation: remove the `off` and add explicit `max-lines-per-function` caps per subfolder (mirror the recorder/options pattern):
- `macro-controller/src/ui/**`: `max: 80` (start lax, tighten later).
- `macro-controller/src/db/**`, `**/core/**`: `max: 60`.
- `marco-sdk/**`, `lovable-common/**`: `max: 50`.

## Finding CX-2 - `sonarjs/cognitive-complexity` warnings suppressed by same override (P0)

Same override block (`eslint.config.js:384`) turns off SonarJS complexity for a subset of `standalone-scripts/**` files. The top-10 largest files (see CX-3 table) are exactly the shape (deep switch/if trees, dropdown builders, modal composers) that SonarJS is designed to catch.

Remediation: keep the SonarJS rule active at `warn`, override per-file only when a genuine data-driven switch (e.g. schema migration) trips it.

## Finding CX-3 - File-level LOC hotspots (proxy signal while eslint is silent)

Top 20 files by production LOC (audit ranking, not a hard rule):

| Rank | File | LOC | Note |
|---|---|---|---|
| 1 | `macro-controller/src/ui/prompt-dropdown.ts` | 1441 | Also flagged in report 09 (0 tests) and report 05 (design tokens) |
| 2 | `macro-controller/src/ws-list-renderer.ts` | 1156 | 15 raw localStorage literals overlap with report 08 |
| 3 | `macro-controller/src/ui/projects-modal.ts` | 1114 | 44 hex literals (report 05 top) + no tests |
| 4 | `macro-controller/src/ui/settings-tab-panels.ts` | 901 | 7 innerHTML sinks (report 04) |
| 5 | `macro-controller/src/startup.ts` | 880 | Unannotated silent catch at :358 (report 06) |
| 6 | `macro-controller/src/ws-members-panel.ts` | 852 | - |
| 7 | `macro-controller/src/ui/error-overlay.ts` | 802 | - |
| 8 | `macro-controller/src/ui/task-splitter-ui.ts` | 727 | Bypasses tracked-interval registry (report 07 T-1) |
| 9 | `macro-controller/src/ws-hover-card.ts` | 709 | 34 hex literals (report 05) |
| 10 | `macro-controller/src/ui/prompt-import-modal.ts` | 709 | 14 innerHTML sinks (report 04 top) |
| 11 | `macro-controller/src/ui/bulk-rename.ts` | 707 | 6 innerHTML sinks |
| 12 | `macro-controller/src/ui/credit-totals-modal.ts` | 703 | - |
| 13 | `macro-controller/src/ui/repeat-loop-ui.ts` | 655 | Preset test gap (report 09 TC-3) |
| 14 | `macro-controller/src/ui/prompt-library-modal.ts` | 626 | Already refactored; keep as compliant reference |
| 15 | `macro-controller/src/ui/macro-ui.ts` | 600 | 2 leaking setInterval (report 07 T-2) |
| 16 | `macro-controller/src/ui/panel-controls.ts` | 564 | - |
| 17 | `macro-controller/src/ui/task-next-ui.ts` | 563 | - |
| 18 | `macro-controller/src/ws-move.ts` | 548 | - |
| 19 | `macro-controller/src/ui/prompt-utils.ts` | 520 | Leaking setInterval (report 07) |
| 20 | `macro-controller/src/ws-context-menu.ts` | 504 | - |

Cross-cutting insight: **9 of the top 20 also appear in at least one previous audit report** (P0/P1 findings). Refactoring these files first pays off in report 04/05/06/07/08/09 simultaneously.

## Finding CX-4 - The refactor unit is `ui/`, not the file (P1)

`macro-controller/src/ui/` holds 101 files totalling ~34 800 LOC (~48 % of the whole repo). File-splitting inside `ui/` will not compound unless a shared `ui/primitives/` layer emerges (button/modal/dropdown/list-row shells). Report 04 flagged the absence of a shared `escapeHtml`; report 05 flagged the absence of semantic tokens; report 07 flagged the absence of a shared observer-lifecycle helper. All three point at the same missing primitive layer.

Remediation shape (future task, not this audit): create `macro-controller/src/ui/primitives/` with `escape-html.ts`, `observer-lifecycle.ts`, `dark-tokens.ts`, `modal-shell.ts`. Migrate the top-5 LOC files first; expect ~30 % LOC reduction in each.

## Finding CX-5 - No LOC ceiling policy (P2)

There is no repo-level rule "files > 1000 LOC require a refactor ticket". `prompt-dropdown.ts` at 1441 LOC and `ws-list-renderer.ts` at 1156 LOC have grown organically past reasonable review-ability. Suggest a soft ceiling of 800 LOC/file recorded in `spec/02-coding-guidelines/` and a hard ceiling of 1200 LOC enforced by `scripts/check-file-loc-ceiling.mjs`.

## Backlog rollup

| ID | Severity | Where | Effort |
|---|---|---|---|
| CX-1 | P0 | `eslint.config.js:326` - re-enable `max-lines-per-function` for `standalone-scripts/**` | 30 min (config + per-folder caps) |
| CX-2 | P0 | `eslint.config.js:384` - re-enable `sonarjs/cognitive-complexity` | 15 min |
| CX-3 | P1 | Top-10 file refactor (compound wins with reports 04-08) | 6-10 h (spread across future releases) |
| CX-4 | P1 | Introduce `ui/primitives/` layer | 4-6 h |
| CX-5 | P2 | `check-file-loc-ceiling.mjs` + guideline | 45 min |

No source-code changes in this release (audit-only). CX-1 and CX-2 are the compound unlocker for every future refactor conversation.
