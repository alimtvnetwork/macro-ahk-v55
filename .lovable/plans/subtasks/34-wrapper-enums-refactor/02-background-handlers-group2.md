# SS-B: Background Handlers (Group 2)
Status: ✅ Done

## Task
Wrap `db.run`, `db.exec`, and `db.prepare` calls with `ServiceResult.wrapDb(() => { ... })` in the following files:
- `src/background/handlers/kv-handler.ts` (Done)
- `src/background/handlers/library-handler.ts` (Done)
- `src/background/handlers/logging-export-handler.ts` (Done)
- `src/background/handlers/logging-handler.ts` (Done)
- `src/background/handlers/logging-queries.ts` (Done)

## Rules
- Ensure `import { ServiceResult } from '@/utils/result-wrapper';` is added.
- Swap naked db calls for `ServiceResult.wrapDb(() => db.run(...))`.
- Change any inverted success checks (`!resp.ok`) to `resp.isFail`.

## Update Requirements
1. Mark Status as `🔄 In Progress` when starting.
2. Mark Status as `✅ Done` when finished, and list the files changed.
3. Signal the main agent when complete.
