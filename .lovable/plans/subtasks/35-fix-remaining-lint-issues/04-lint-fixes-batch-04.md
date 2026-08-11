# Subtask 04: Lint Fixes Batch 04
Status: ✅ Done

## Goal
Fix ESLint violations in the assigned files.

## Files to Modify
- `D:\work\macro-ahk\src\background\handlers\injection-toast.ts` (Violations: 12)
  - `max-statements-per-line`: 12
- `D:\work\macro-ahk\src\background\handlers\kv-handler.ts` (Violations: 2)
  - `@typescript-eslint/ban-ts-comment`: 2
- `D:\work\macro-ahk\src\background\handlers\project-api-handler.ts` (Violations: 1)
  - `sonarjs/cognitive-complexity`: 1
- `D:\work\macro-ahk\src\background\handlers\prompt-handler.ts` (Violations: 7)
  - `max-lines-per-function`: 1
  - `max-statements-per-line`: 6
- `D:\work\macro-ahk\src\background\handlers\recorder-capture-handler.ts` (Violations: 1)
  - `@typescript-eslint/ban-ts-comment`: 1

## Instructions
- Run `npx eslint <file>` to verify fixes as you go.
- Do not break functionality when splitting functions.
- Update this file to Status: ✅ Done when finished.
