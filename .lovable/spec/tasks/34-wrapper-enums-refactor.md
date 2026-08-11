# 34-wrapper-enums-refactor
Status: pending
Created: 2026-08-10

## Goal
Implement codebase-wide wrapper and enum refactoring to conform to strict typing and error management guidelines.

## Actions
- Implement a universal query wrapper `ServiceResult.wrapDb(dbAction: () => T)` for TS that automatically logs failures to reduce scattered logging.
- Refactor all TypeScript string union types (e.g., "pass" | "fail" | "fallback") into Enums ending with Type and values in PascalCase.
- Enforce explicit boolean checks `isFail` over inverted `!isSuccess` or `!ok` across all 34 identified files.
- Purge magic strings and magic numbers unless explicitly used and typed for logging.

## Execution Routing
This plan is broken down into 5 concurrent subtasks. Sub-agents must execute these.

### Subtask A: Background Handlers (Group 1)
- Files: `src/background/handlers/automation-chain-handler.ts`, `dynamic-require-handler.ts`, `error-handler.ts`, `file-storage-handler.ts`, `grouped-kv-handler.ts`
- Status: ⏳ Pending

### Subtask B: Background Handlers (Group 2)
- Files: `src/background/handlers/kv-handler.ts`, `library-handler.ts`, `logging-export-handler.ts`, `logging-handler.ts`, `logging-queries.ts`
- Status: ⏳ Pending

### Subtask C: Background Handlers (Group 3)
- Files: `src/background/handlers/project-api-handler.ts`, `prompt-handler.ts`, `storage-browser-handler.ts`, `storage-handler.ts`, `updater-handler.ts`, `user-script-log-handler.ts`
- Status: ⏳ Pending

### Subtask D: Background Core & Scripts
- Files: `src/background/config-seeder.ts`, `db-manager.ts`, `db-persistence.ts`, `project-db-manager.ts`, `recorder-db-schema.ts`, `sqlite-bind-safety.ts`
- Status: ⏳ Pending

### Subtask E: Inverted Checks & Magic Strings
- Replace `!resp.Ok`, `!resp.ok`, `!resp.isSuccess` with `resp.isFail`. Use PascalCase Enums.
- Files: `src/background/recorder/**/*.ts`, `src/components/options/**/*.tsx`
- Status: ⏳ Pending
