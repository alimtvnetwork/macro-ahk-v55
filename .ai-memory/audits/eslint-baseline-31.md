# ESLint baseline (refreshed for Plan 33)

Snapshot: v4.353.0, 2026-07-20 (project-local render).

## Totals
- Errors: **0**
- Warnings: **81** across 67 files (pre-Step-2), **80** after Step 2 (HttpFailFastBanner refactor).

## Rule breakdown
| Rule | Count |
| --- | --- |
| `max-lines-per-function` | 77 |
| `sonarjs/cognitive-complexity` | 3 |
| `sonarjs/no-collapsible-if` | 1 |

## Notes for Plan 33
- The original Plan 31 draft targeted ~36 `id-denylist` errors on `ctx`. Those are **already cleared** in main; do not re-plan for them.
- Remaining warnings are dominated by function-length cap violations in options-panel React components (`ProjectDetailView`, `GroupInputsDialog`, `RunGroupDialog`, `RecorderStepDetail`, etc.) and a handful of hooks (`use-recorder-visualisation-controller`, `use-csv-input-controller`).
- Zero-target ratchet (Step 8 of Plan 33) should be armed against the current 80-warning baseline once ~10 more files are refactored to build momentum.

## Reproduce
```
npx eslint . -f json > /tmp/eslint.json
```
