# SS-C: Background Handlers (Group 3)
Status: ✅ Done

## Task
Wrap `db.run`, `db.exec`, and `db.prepare` calls with `ServiceResult.wrapDb(() => { ... })` in the following files:
- `src/background/handlers/project-api-handler.ts`
- `src/background/handlers/prompt-handler.ts`
- `src/background/handlers/storage-browser-handler.ts`
- `src/background/handlers/storage-handler.ts`
- `src/background/handlers/updater-handler.ts`
- `src/background/handlers/user-script-log-handler.ts`

## Rules
- Ensure `import { ServiceResult } from '@/utils/result-wrapper';` is added.
- Swap naked db calls for `ServiceResult.wrapDb(() => db.run(...))`.
- Change any inverted success checks (`!resp.ok`) to `resp.isFail`.

## Update Requirements
1. Mark Status as `🔄 In Progress` when starting.
2. Mark Status as `✅ Done` when finished, and list the files changed.
3. Signal the main agent when complete.

## Changed Files
- `src/background/handlers/project-api-handler.ts`
- `src/background/handlers/prompt-handler.ts`
- `src/background/handlers/storage-browser-handler.ts`
- `src/background/handlers/storage-handler.ts`
- `src/background/handlers/updater-handler.ts`
- `src/background/handlers/user-script-log-handler.ts`
