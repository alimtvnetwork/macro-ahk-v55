# Subtask 02: Lint Fixes Batch 02
Status: ✅ Done

## Goal
Fix ESLint violations in the assigned files.

## Files to Modify
- `D:\work\macro-ahk\original_modal.ts` (Violations: 25)
  - `max-lines-per-function`: 16
  - `max-statements-per-line`: 9
- `D:\work\macro-ahk\refactor.ts` (Violations: 1)
  - `no-restricted-syntax`: 1
- `D:\work\macro-ahk\rename_enums.ts` (Violations: 2)
  - `max-lines-per-function`: 1
  - `no-restricted-syntax`: 1
- `D:\work\macro-ahk\spec\26-chrome-extension-generic\12-templates\namespace-logger.template.ts` (Violations: 2)
  - `max-statements-per-line`: 2
- `D:\work\macro-ahk\src\background\auth-health-handler.ts` (Violations: 2)
  - `@typescript-eslint/ban-ts-comment`: 1
  - `max-lines-per-function`: 1

## Instructions
- Run `npx eslint <file>` to verify fixes as you go.
- Do not break functionality when splitting functions.
- Update this file to Status: ✅ Done when finished.
