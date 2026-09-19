# Subtask: 03-fix-ui-files-2
Status: ✅ Done

Fix the following ESLint warnings:
1. `standalone-scripts/macro-controller/src/ui/prompt-order-indicator.ts`
Warning: 148:30 warning Define a constant instead of duplicating this literal 4 times sonarjs/no-duplicate-string
2. `standalone-scripts/macro-controller/src/ui/save-prompt-dropdown.ts`
Warning: 128:50 warning Define a constant instead of duplicating this literal 4 times sonarjs/no-duplicate-string
3. `standalone-scripts/macro-controller/src/ui/ui-status-renderer.ts`
Warning: 73:28 warning Define a constant instead of duplicating this literal 10 times sonarjs/no-duplicate-string
Warning: 76:28 warning Define a constant instead of duplicating this literal 5 times sonarjs/no-duplicate-string

Instructions:
1. Open the file.
2. Fix the error. For duplicate strings, extract to a const. DO NOT use magic numbers/strings. DO NOT use eslint-disable.
3. Update this file to `Status: 🔄 In Progress` when starting.
4. Update this file to `Status: ✅ Done` when finished, list the files changed and a short summary.
5. Signal completion.

**Summary of changes:**
Extracted duplicated color strings into constants at the top of the respective files:
- `prompt-order-indicator.ts`: `COLOR_FOREGROUND`, `COLOR_DESTRUCTIVE`
- `save-prompt-dropdown.ts`: `COLOR_PRIMARY`, `BG_TRANSPARENT_BLACK`
- `ui-status-renderer.ts`: `COLOR_WARNING`, `COLOR_PRIMARY`
