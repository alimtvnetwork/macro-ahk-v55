# ESLint Baseline — Plan 24, Step 1

Captured: 2026-07-19
Command: `npx eslint . -f json`
Raw: `.lovable/audits/eslint-baseline-24.json`

## Totals
- Files with issues: 101
- Warnings: 193
- Errors: 8

## By rule (top)
| Rule | Count |
| --- | --- |
| max-lines-per-function | 151 |
| sonarjs/cognitive-complexity | 27 |
| id-denylist | 8 |
| sonarjs/no-duplicate-string | 7 |
| sonarjs/no-collapsible-if | 2 |
| (parse error) | 2 |
| react-refresh/only-export-components | 2 |
| react-hooks/exhaustive-deps | 2 |

Notes:
- The uploaded log (user-uploads://file-27) was from a sibling repo (macro-ahk-v54) with 265 issues; the current project baseline is 201 total (193 warn + 8 err). Plan 24 steps 3-11 target file paths that may not exist in this repo; step 2 subtasks stay authoritative for the recipes, but per-file steps will be re-scoped to actual offenders in step 2 follow-up before step 3 begins.
- 2 parse errors must be resolved first (they mask further linting in those files).
