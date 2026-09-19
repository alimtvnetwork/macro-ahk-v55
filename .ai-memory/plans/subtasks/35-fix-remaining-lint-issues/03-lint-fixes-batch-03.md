# Subtask 03: Lint Fixes Batch 03
Status: ✅ Done

## Goal
Fix ESLint violations in the assigned files.

## Files to Modify
- `D:\work\macro-ahk\src\background\first-attach-toast.ts` (Violations: 1)
  - `max-statements-per-line`: 1
- `D:\work\macro-ahk\src\background\handlers\config-auth-handler.ts` (Violations: 2)
  - `max-lines-per-function`: 2
- `D:\work\macro-ahk\src\background\handlers\file-storage-handler.ts` (Violations: 4)
  - `@typescript-eslint/ban-ts-comment`: 1
  - `max-lines-per-function`: 1
  - `@typescript-eslint/no-explicit-any`: 2
- `D:\work\macro-ahk\src\background\handlers\grouped-kv-handler.ts` (Violations: 3)
  - `@typescript-eslint/ban-ts-comment`: 1
  - `@typescript-eslint/no-explicit-any`: 2
- `D:\work\macro-ahk\src\background\handlers\handler-guards.ts` (Violations: 4)
  - `max-statements-per-line`: 4

## Instructions
- Run `npx eslint <file>` to verify fixes as you go.
- Do not break functionality when splitting functions.
- Update this file to Status: ✅ Done when finished.
