# RCA: DB Wrapper & Inverted Boolean Checks

## Incident Description
Previous architecture relied on naked DB calls (e.g., `db.run`, `db.exec`) scattered across ~30 background handlers, with repetitive `try-catch` blocks and manual logging logic. In addition, conditional state validation relied on inverted success checks (e.g. `!response.ok` or `!response.isSuccess`) instead of explicitly defining semantic failure.

## Root Cause
- **Scattered Logging**: The absence of a centralized boundary wrapper for DB executions forced developers to write manual boilerplate everywhere. When an exception is thrown by `sql.js` (e.g. unique constraint failure or SQL syntax error), it requires immediate capture. Scattered handlers meant some could accidentally swallow or mis-log these exceptions.
- **Inverted Checks**: Using `!response.ok` or `!response.isSuccess` creates cognitive load and increases the risk of null-reference bugs (if `response` itself is nullish, `!null.ok` throws).

## Prevention & Resolution
1. **Universal Query Wrapper**: Introduce `ServiceResult.wrapDb()` to centrally manage all try-catch operations for SQL interactions. Any thrown exceptions are automatically captured via `Logger.error()` and encapsulated within the `.isFail` / `.error` properties of the `ServiceResult` object, safely preventing background crashes without scattering logic.
2. **Explicit Intent**: Never use inverted success checks. Instead of `!resp.ok`, explicitly verify failure via `resp.isFail`.
3. **No Magic Strings**: All state and status strings must be formalized as Enums that end with the `Type` suffix (e.g. `StatusType`), using `PascalCase` properties for values.
