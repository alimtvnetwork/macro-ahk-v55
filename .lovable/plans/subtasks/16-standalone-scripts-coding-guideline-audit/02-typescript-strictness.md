# SS-02 typescript-strictness scan

Parent: 16-standalone-scripts-coding-guideline-audit
Status: pending
Created: 2026-07-27

## Rules sourced from

- `spec/02-coding-guidelines/02-typescript/**`
- `mem://standards/unknown-usage-policy`
- `mem://standards/formatting-and-logic` (CQ14 braces, CQ15 newlines, defensive property access)

## Grep sweeps

- `rg -n ': any\b|as any\b' standalone-scripts/**/src`
- `rg -n ': unknown\b' standalone-scripts/**/src` (allowed only inside `CaughtError`).
- `rg -n '@ts-ignore|@ts-nocheck|@ts-expect-error' standalone-scripts/**/src`
- `rg -n 'function \w+\s*\([^)]{200,}' standalone-scripts/**/src` (over-long signatures).
- ESLint rules to spot-check: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unsafe-*`, `complexity`, `max-lines-per-function`, `max-params`.

## Output shape (rows in `01-typescript-strictness.md`)

`| file:line | ruleId | severity | quote | fixHint |`
