# Subtask: 02-fix-ui-files-1
Status: ✅ Done

### Summary
Extracted duplicated string literals into constants to fix `sonarjs/no-duplicate-string` ESLint warnings in:
- `credit-totals-modal.ts` (`HSL_FOREGROUND`)
- `prompt-library-row.ts` (`HSL_FOREGROUND`, `HSL_MUTED`)
- `prompt-library-shell.ts` (`CSS_BG_BACKGROUND`, `CSS_COLOR_FOREGROUND`)

Fix the following ESLint warnings:
1. `standalone-scripts/macro-controller/src/ui/credit-totals-modal.ts`
Warning: 107:10 warning Define a constant instead of duplicating this literal 4 times sonarjs/no-duplicate-string
2. `standalone-scripts/macro-controller/src/ui/prompt-library-row.ts`
Warning: 28:128 warning Define a constant instead of duplicating this literal 5 times sonarjs/no-duplicate-string
Warning: 45:80 warning Define a constant instead of duplicating this literal 5 times sonarjs/no-duplicate-string
3. `standalone-scripts/macro-controller/src/ui/prompt-library-shell.ts`
Warning: 252:91 warning Define a constant instead of duplicating this literal 4 times sonarjs/no-duplicate-string
Warning: 252:206 warning Define a constant instead of duplicating this literal 5 times sonarjs/no-duplicate-string

Instructions:
1. Open the file.
2. Fix the error. For duplicate strings, extract to a const. DO NOT use magic numbers/strings. DO NOT use eslint-disable.
3. Update this file to `Status: 🔄 In Progress` when starting.
4. Update this file to `Status: ✅ Done` when finished, list the files changed and a short summary.
5. Signal completion.
