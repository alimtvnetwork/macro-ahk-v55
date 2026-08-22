# RCA: Vitest Crash on prompt-handler-delete.test.ts

## Incident Overview
**Error:** `TypeError: Cannot read properties of undefined (reading '0')` on `result.data![0].values[0][0]`.
**Phase:** CI/CD Testing Gate (`vitest run`)
**Date:** 2026-08-22

## Root Cause
In my very first refactoring attempt (commit `10c5fbf3`), the AST un-wrapper script stripped `ServiceResult.wrapDb()` completely from `src/background/handlers/prompt-handler.ts`. 

The original code in `handleSavePrompt` looked like this:
```typescript
const result = ServiceResult.wrapDb(() => db.exec("SELECT last_insert_rowid()"));
if (result.Ok === false) throw new Error(...);
promptId = String(result.data![0].values[0][0]);
```
When the script removed the wrapper, the line became `const result = db.exec(...)`, which returns a native SQLite `QueryExecResult[]` array.

Because `QueryExecResult[]` is an array, it does not possess `.Ok` or `.data` properties. Thus, `result.Ok` evaluated to `undefined === false` (which bypassed the throw block), and `result.data` evaluated to `undefined`, triggering a `TypeError` when `[0]` was accessed during the test.

**Why did TypeScript fail to catch this?**
The frontend compilation config (`tsconfig.app.json`) explicitly excludes `src/background`. Because `prompt-handler.ts` is never imported by the frontend UI, the standard CI `pnpm run typecheck` gate never scanned it. The typing violation remained hidden until `vitest` imported the file directly at runtime.

## Resolution
1. Rewrote the array extraction in `prompt-handler.ts` to access the native SQLite `QueryExecResult[]` directly without relying on non-existent `ServiceResult` object properties.
2. Removed the hallucinated `.Ok` object check.
3. Successfully executed `npx vitest run src/background/handlers/prompt-handler-delete.test.ts` to verify the `TypeError` is resolved.
4. Pushed the fix to `main`.
