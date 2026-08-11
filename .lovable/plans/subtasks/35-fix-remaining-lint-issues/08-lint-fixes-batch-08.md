# Subtask 08: Lint Fixes Batch 08
Status: ✅ Done

## Goal
Fix ESLint violations in the assigned files.

## Files to Modify
- `D:\work\macro-ahk\src\background\recorder\step-library\export-bundle.ts` (Violations: 2)
  - `max-statements-per-line`: 2
- `D:\work\macro-ahk\src\background\recorder\step-library\import-bundle.ts` (Violations: 2)
  - `max-lines-per-function`: 2
- `D:\work\macro-ahk\src\background\recorder\step-library\replay-bridge.ts` (Violations: 2)
  - `@typescript-eslint/ban-ts-comment`: 1
  - `max-lines-per-function`: 1
- `D:\work\macro-ahk\src\background\recorder\step-library\run-batch.ts` (Violations: 1)
  - `@typescript-eslint/ban-ts-comment`: 1
- `D:\work\macro-ahk\src\background\recorder\url-tab-click.ts` (Violations: 1)
  - `@typescript-eslint/ban-ts-comment`: 1

## Instructions
- Run `npx eslint <file>` to verify fixes as you go.
- Do not break functionality when splitting functions.
- Update this file to Status: ✅ Done when finished.
