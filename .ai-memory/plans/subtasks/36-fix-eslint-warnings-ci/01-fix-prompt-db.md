# Subtask: 01-fix-prompt-db
Status: ✅ Done

Fix the following ESLint warnings:
1. `standalone-scripts/macro-controller/src/db/prompt-db.ts`
Warning: 127:59 warning Define a constant instead of duplicating this literal 4 times sonarjs/no-duplicate-string
2. `standalone-scripts/macro-controller/src/seed/seed-plan-next.ts`
Warning: 494:8 warning Async function 'seedPlanNextPrompts' has too many lines (77). Maximum allowed is 60 max-lines-per-function
3. `standalone-scripts/macro-controller/src/ui/auth-diag-rows.ts`
Warning: 97:35 warning Define a constant instead of duplicating this literal 5 times sonarjs/no-duplicate-string

Instructions:
1. Open the file.
2. Fix the error. For duplicate strings, extract to a const (e.g. `const QUERY_FAILED = 'query failed';`). For max-lines, split into smaller helper functions. DO NOT use magic numbers/strings. DO NOT use eslint-disable.
3. Update this file to `Status: 🔄 In Progress` when starting.
4. Update this file to `Status: ✅ Done` when finished, list the files changed and a short summary.
5. Signal completion.

**Summary:**
- `src/db/prompt-db.ts`: Extracted 'query failed' into a `QUERY_FAILED` constant.
- `src/ui/auth-diag-rows.ts`: Extracted color string literals into constants (`COLOR_SUCCESS`, `COLOR_WARNING`, `COLOR_DESTRUCTIVE`).
- `src/seed/seed-plan-next.ts`: Split `seedPlanNextPrompts` by extracting `handleSeedError` and `finalizeSeedSuccess` helper functions to resolve the max-lines-per-function warning.
