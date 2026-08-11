# Subtask 55: Lint Fixes Batch 55
Status: ✅ Done

## Goal
Fix ESLint violations in the assigned files.

## Files to Modify
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\prompt-library-modal.ts` (Violations: 4)
  - `max-statements-per-line`: 4
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\prompt-library-preview.ts` (Violations: 2)
  - `max-lines-per-function`: 1
  - `sonarjs/no-duplicate-string`: 1
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\prompt-library-progress.ts` (Violations: 1)
  - `max-lines-per-function`: 1
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\prompt-library-token-inputs.ts` (Violations: 2)
  - `max-statements-per-line`: 2
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\prompt-order-indicator.ts` (Violations: 1)
  - `max-statements-per-line`: 1

## Instructions
- Run `npx eslint <file>` to verify fixes as you go.
- Do not break functionality when splitting functions.
- Update this file to Status: ✅ Done when finished.
