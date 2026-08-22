# RCA: TypeScript Typecheck Failure (isFail does not exist on type Database)

## Incident Overview
**Error:** `error TS2339: Property 'isFail' does not exist on type 'Database'` (and similar errors across 6 files).
**Phase:** CI/CD Typecheck Gate (`tsc --noEmit -p tsconfig.app.json`)
**Date:** 2026-08-22

## Root Cause
In an effort to resolve the `SEEDER_ERROR (stmt.step is not a function)` caused by a previous automated refactoring script blindly injecting `ServiceResult.wrapDb` everywhere, a corrective AST script was deployed to strip `ServiceResult.wrapDb` from all files in `src/background/handlers/**/*.ts`.

However, this un-wrapping script was too aggressive. It removed `ServiceResult.wrapDb` from **all** files, including six files (`file-storage-handler.ts`, `grouped-kv-handler.ts`, `kv-handler.ts`, `logging-queries.ts`, `project-api-handler.ts`, `sqlite-bind-safety.ts`) that were actually written *correctly* to expect the `ServiceResult` wrapper. Because the wrapper was stripped, these files received raw SQLite `Database` or `Statement` objects instead of `ServiceResult` objects, causing the type-checker to correctly flag `.isFail`, `.error`, and `.data` as non-existent properties on those native types.

## Resolution
1. Identified the exactly 6 files that correctly utilized `ServiceResult` (handling `.isFail` checks and unwrapping `.data` before calling `.step()`).
2. Restored these 6 files to their pre-unwrapped state from `HEAD~1`, reinstating their `ServiceResult.wrapDb` usages.
3. Kept the unwrapping fix intact for the files that actually caused the runtime crash (e.g., `updater-handler.ts`, `prompt-handler.ts`), which were blindly calling `.step()` directly on the wrapper.
4. Validated the fix by running `tsc --noEmit`, ensuring 0 type errors.

## Prevention
1. **Targeted AST manipulation:** When writing AST refactoring scripts to clean up automated damage, ensure the script differentiates between broken structural patterns (e.g., `wrapDb(...).step()`) and correctly implemented patterns (e.g., `if (wrap.isFail) ... wrap.data.step()`).
2. **Local Compiler Verification:** Always run `pnpm run typecheck` or `tsc --noEmit` locally before pushing AST-wide replacements to catch structural typing regressions before they reach CI.
