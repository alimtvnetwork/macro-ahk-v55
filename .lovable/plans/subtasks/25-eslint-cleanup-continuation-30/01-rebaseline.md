# SS-01 — Re-baseline ESLint against current tree

Slug: ss-01-rebaseline
Status: pending
Created: 2026-07-19
Parent: 25-eslint-cleanup-continuation-30

## Goal

Produce a current, authoritative ESLint offender ranking so Steps 9-25 target real files instead of the stale baseline-24 list (which was captured before SS-01..SS-09 landed).

## Actions

1. `npx eslint . -f json > .lovable/audits/eslint-baseline-25.json` (allow non-zero exit).
2. `npx eslint . -f stylish 2> .lovable/audits/eslint-baseline-25.stderr | tee .lovable/audits/eslint-baseline-25.stylish.txt` for humans.
3. Write `.lovable/audits/eslint-baseline-25.md` with:
   - Totals (files, warnings, errors).
   - "By rule" table sorted desc.
   - "Top 25 offenders by `max-lines-per-function` line count" (file + function + line count).
   - "Top 10 offenders by `sonarjs/cognitive-complexity` score".
   - Diff-from-baseline-24 section (net delta per rule).
4. Do NOT modify source files in this subtask — reporting only.

## Verification

- `eslint-baseline-25.json` exists and parses as valid JSON.
- `eslint-baseline-25.md` totals cross-check with the JSON count.
- The offender tables have enough rows to drive Steps 9-25 (>=15 rows for `max-lines-per-function`, >=5 for cognitive-complexity).
