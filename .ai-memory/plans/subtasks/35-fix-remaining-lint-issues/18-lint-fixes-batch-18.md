# Subtask 18: Lint Fixes Batch 18
Status: ✅ Done

## Goal
Fix ESLint violations in the assigned files.

## Files to Modify
- `D:\work\macro-ahk\src\components\options\project-database\SchemaTab.tsx` (Violations: 1)
  - `max-statements-per-line`: 1
- `D:\work\macro-ahk\src\components\options\project-database\useConfigDb.ts` (Violations: 5)
  - `max-statements-per-line`: 3
  - `max-lines-per-function`: 2
- `D:\work\macro-ahk\src\components\options\project-database\useSchemaBuilder.ts` (Violations: 2)
  - `max-lines-per-function`: 2
- `D:\work\macro-ahk\src\components\options\project-detail\ProjectHeader.tsx` (Violations: 5)
  - `max-statements-per-line`: 5
- `D:\work\macro-ahk\src\components\options\project-files\utils.ts` (Violations: 2)
  - `max-lines-per-function`: 1
  - `@typescript-eslint/ban-ts-comment`: 1

## Instructions
- Run `npx eslint <file>` to verify fixes as you go.
- Do not break functionality when splitting functions.
- Update this file to Status: ✅ Done when finished.
