# Subtask 01 — Refresh ESLint baseline

Slug: 01-refresh-baseline
Parent: 33-plan-10
Status: pending
Created: 2026-07-20

## Goal

Regenerate `.lovable/audits/eslint-baseline-31.md` so it reflects the current tree, not the pre-rename snapshot from Plan 31 Step 1.

## Procedure

1. Run: `pnpm lint --format=json > /tmp/eslint-33.json 2>&1 || true` (lint may exit non-zero; we still want the JSON).
2. Filter for the three counters:
   - `id-denylist` where the identifier is `ctx`
   - `sonarjs/cognitive-complexity`
   - `max-lines-per-function`
3. Write a fresh markdown table per section (A: ctx, B: max-lines, C: cognitive-complexity).
4. Update the top-of-file `Totals:` line with the new counts.
5. Commit the refreshed audit in the same change as Step 2 of the parent plan.

## Verification

- File byte-diff shows non-trivial delta.
- Row counts in the markdown tables match the `Totals:` header exactly.
- `wc -l .lovable/audits/eslint-baseline-31.md` reflects the new size.
