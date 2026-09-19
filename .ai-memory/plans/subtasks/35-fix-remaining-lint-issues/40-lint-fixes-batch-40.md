# Subtask 40: Lint Fixes Batch 40
Status: ✅ Done

## Goal
Fix ESLint violations in the assigned files.

## Files to Modify
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\settings-modal.ts` (Violations: 1)
  - `max-statements-per-line`: 1
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\startup-persistence.ts` (Violations: 2)
  - `max-lines-per-function`: 1
  - `max-statements-per-line`: 1
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\__tests__\pending-restore-undo-negatives.test.ts` (Violations: 2)
  - `max-statements-per-line`: 2
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\__tests__\prompt-editor-diff-shortcut.test.ts` (Violations: 1)
  - `max-statements-per-line`: 1
- `D:\work\macro-ahk\standalone-scripts\macro-controller\src\ui\__tests__\prompt-history-panel.test.ts` (Violations: 1)
  - `max-statements-per-line`: 1

## Instructions
- Run `npx eslint <file>` to verify fixes as you go.
- Do not break functionality when splitting functions.
- Update this file to Status: ✅ Done when finished.
