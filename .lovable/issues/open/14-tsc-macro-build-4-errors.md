# 14 - tsc macro build: 4 type errors

User request (verbatim):

> Run npx tsc --noEmit -p tsconfig.macro.build.json ... 4 errors in database-json-migrate.ts (L196,211,222) and prompt-dropdown-io.ts (L62).

## Errors

- `ui/database-json-migrate.ts:196,211,222` — `.then((resp: ExtensionCallbackResponse) => ...)` incompatible with `runSqlBridge` return type `SqlBridgeResp` under `exactOptionalPropertyTypes`.
- `ui/prompt-dropdown-io.ts:62` — `readUserAddedEntries` return type declares `entries` but returns `{ kept, defaultsSkipped }`.

## DoD

`npx tsc --noEmit -p tsconfig.macro.build.json` exits 0.

## Fix

- Annotated the three `.then` callbacks in `database-json-migrate.ts` with `SqlBridgeResp` (imported from `../db/sql-bridge`).
- Mapped `{ kept, defaultsSkipped }` → `{ entries: kept, defaultsSkipped }` inside `readUserAddedEntries`.