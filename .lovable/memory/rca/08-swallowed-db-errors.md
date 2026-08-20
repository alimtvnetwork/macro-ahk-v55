# RCA: Swallowed DB Errors & Repetitive Error Logging

## Issue
Database queries (`db.exec`, `db.run`, `stmt.run`) were being manually wrapped in `try/catch` blocks, with many instances either swallowing errors (`void 0;`) or using bare `console.error` calls instead of the mandatory `RiseupAsiaMacroExt.Logger.error()` logging contract. This resulted in bloated code, repeated boilerplate, and silent failures when DB querying failed.

## Root Cause
Developers circumvented the logging constraints by manually writing `try/catch` blocks, lacking a standardized wrapper for database operations that natively incorporates the global logger and returns an `isSuccess`/`isFail` state. 

## Resolution
- Upgraded `ServiceResult.wrapDb` in `src/utils/result-wrapper.ts` to automatically route errors to `RiseupAsiaMacroExt.Logger.error` and provide a semantic result (`isFail`, `data`).
- Refactored `sqlite-bundle.ts` to use `ServiceResult.wrapDb` for all DB query executions, eliminating `void 0;` swallowed exceptions and significantly reducing boilerplate.

## Prevention (Avoid)
- **Avoid manual `try/catch` on DB queries:** Always use `ServiceResult.wrapDb()` to execute SQL operations.
- **Never swallow DB exceptions:** The wrapper ensures no silent failures occur.

Memory updated in `constraints/01-rules.md`.
