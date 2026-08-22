# RCA: SEEDER_ERROR (TypeError: stmt.step is not a function)

## Incident Overview
**Error:** `TypeError: stmt.step is not a function` at `handleListUpdaters` (and others)
**Phase:** Service Worker Boot / SDK Updater Seeding
**Date:** 2026-08-22

## Root Cause
A mass-refactoring script (`gemini-refactor/refactor.cjs`) aggressively wrapped all `db.prepare`, `db.run`, and `db.exec` calls inside `src/background/handlers/**/*.ts` with `ServiceResult.wrapDb()`. 

However, `ServiceResult.wrapDb()` returns an object of type `{ ok: boolean, data: T }`, not the raw SQLite statement (`db.Statement`). The automated script did not rewrite the downstream caller logic to unwrap the `.data` property before calling SQLite methods. 

As a result, statements like this:
```typescript
const stmt = ServiceResult.wrapDb(() => db.prepare("SELECT * FROM UpdaterDetails ORDER BY Name"));
while (stmt.step()) { ... }
```
...crashed at runtime, because `stmt` was a `ServiceResult` object, not a `Statement`, so `stmt.step` was `undefined`. This triggered a fatal exception during the Service Worker boot sequence while seeding the updaters, blocking the entire extension initialization.

## Resolution
1. Wrote a `ts-morph` AST un-wrapper script to surgically locate all broken `ServiceResult.wrapDb` block injections.
2. Stripped the `ServiceResult.wrapDb` wrappers in 17 background handler files, returning them to their raw native return types.
3. Verified the build using strict `tsc` compiler typecheck, which successfully compiled with 0 errors.
4. Committed and pushed the fix to `main`.

## Prevention
1. **Never perform blind AST/regex wraps on methods that return complex objects:** If a function's return type changes (e.g., from `Statement` to `ServiceResult<Statement>`), all downstream property accesses (`.step()`, `.bind()`, `.free()`) must be updated to access the wrapped data property (`.data.step()`).
2. **Compile Check Before Push:** The bug would have been caught instantly by the TypeScript compiler. Always run `pnpm run tsc` or `pnpm run build` locally after running mass AST-modifications.
