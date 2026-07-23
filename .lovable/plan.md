## Context

`npx tsc --noEmit -p tsconfig.macro.build.json` fails with 4 errors after the recent sql-bridge / user-scope export refactors:

1. `ui/database-json-migrate.ts` lines 196, 211, 222: `runSqlBridge(...)` returns `Promise<SqlBridgeResp>` (from `db/sql-bridge.ts`), but the `.then` callbacks annotate the arg as `ExtensionCallbackResponse`. Under `exactOptionalPropertyTypes: true`, `SqlBridgeResp.rows: unknown[]` is not assignable to `ExtensionCallbackResponse.rows: Record<string, unknown>[]`.
2. `ui/prompt-dropdown-io.ts` line 62: `readUserAddedEntries()` is annotated as returning `{ entries; defaultsSkipped }` but returns `io.filterUserAddedEntries(raw)` directly, which now yields `{ kept; defaultsSkipped }` (renamed in `prompt-io.ts`).

Both are pure type / naming drift; runtime behavior is unchanged.

## Issue file

Add `.lovable/issues/open/14-tsc-macro-build-4-errors.md` per the "capture request as issue before planning" command. Quote the user's tsc output verbatim, list the 4 error locations, and set DoD = `npx tsc --noEmit -p tsconfig.macro.build.json` exits 0.

## Fixes

### A. `standalone-scripts/macro-controller/src/ui/database-json-migrate.ts`

For each of the three `.then((resp: ExtensionCallbackResponse) => ...)` call sites (addColumn ~L196, dropColumn ~L211, renameColumn ~L222): change the annotation to `SqlBridgeResp`, imported from `../db/sql-bridge`. This matches the actual return type of `runSqlBridge` and preserves the `isOk` / `errorMessage` fields the handlers use. Remove the now-unused `ExtensionCallbackResponse` import if no other call site in the file needs it (verify with a file-scoped grep before deleting).

### B. `standalone-scripts/macro-controller/src/ui/prompt-dropdown-io.ts`

`readUserAddedEntries()` (around L60): map the bridge result to the local shape so the caller destructuring `{ entries, defaultsSkipped }` keeps working:

```ts
async function readUserAddedEntries(): Promise<{ entries: CachedPromptEntry[]; defaultsSkipped: number }> {
  const io = await import('./prompt-io');
  const raw = await io.collectAllExportEntries();
  const { kept, defaultsSkipped } = io.filterUserAddedEntries(raw);
  return { entries: kept, defaultsSkipped };
}
```

No other call sites are affected (`filterUserAddedEntries` is used elsewhere via its own `kept` field, e.g. `prompt-io.ts` L65).

## Verification

```
npx tsc --noEmit -p tsconfig.macro.build.json           # exits 0
npx eslint standalone-scripts --max-warnings=0          # stays green
npx vitest run standalone-scripts/macro-controller/src/ui/__tests__/prompt-dropdown-io*.test.ts \
  standalone-scripts/macro-controller/src/ui/__tests__/database-json-migrate*.test.ts   # if present; otherwise skip
```

## Out of scope

The 55 vitest failures in the uploaded `error.txt` (regression-baseline `substituteToken` behavior lock, `migrate-legacy-read-memory` timeouts, snapshot / em-dash drift already tracked in issues 12 and 13). Those are separate from the 4 tsc errors and belong to their existing issue files.
