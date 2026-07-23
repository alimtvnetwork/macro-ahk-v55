---
Slug: full-inventory
Status: pending
Created: 2026-07-20
Parent: 31-lint-cleanup-ctx-denylist-and-15-line-cap
---

# SS-01 Full lint inventory

Run `pnpm run lint --no-fix > /tmp/lint-full.log 2>&1`. Extract two tables:

## A. `id-denylist` (identifier: ctx)
| file | line:col | binding kind |
|---|---|---|
| (populate at execution time) | | |

## B. `max-lines-per-function` (all offenders, target cap 15)
| file | line | function | current | cap |
|---|---|---|---|---|

Include repo-wide, not just uploaded excerpt. Save the raw log alongside as `/tmp/lint-full.log` and copy into `.lovable/audits/eslint-baseline-31.md` for durability.
