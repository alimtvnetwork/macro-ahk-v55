# SS-D: Background Core & Scripts
Status: ✅ Done

## Task
Wrap `db.run`, `db.exec`, and `db.prepare` calls with `ServiceResult.wrapDb(() => { ... })` in the following files:
- `src/background/config-seeder.ts`
- `src/background/db-manager.ts`
- `src/background/db-persistence.ts`
- `src/background/project-db-manager.ts`
- `src/background/recorder-db-schema.ts`
- `src/background/sqlite-bind-safety.ts`

## Rules
- Ensure `import { ServiceResult } from '@/utils/result-wrapper';` is added.
- Swap naked db calls for `ServiceResult.wrapDb(() => db.run(...))`.
- Change any inverted success checks (`!resp.ok`) to `resp.isFail`.

## Update Requirements
1. Mark Status as `🔄 In Progress` when starting.
2. Mark Status as `✅ Done` when finished, and list the files changed.
3. Signal the main agent when complete.

## Changed Files
- `src/background/config-seeder.ts`
- `src/background/db-manager.ts`
- `src/background/db-persistence.ts`
- `src/background/project-db-manager.ts`
- `src/background/recorder-db-schema.ts`
- `src/background/sqlite-bind-safety.ts`
