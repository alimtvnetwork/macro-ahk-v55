# RCA: E2E Test Failure Due to Class Getter Serialization (isSuccess)

## Issue
E2E Playwright tests failed for `seed-plan-next-regression.spec.ts` and `prompt-rename-regression.spec.ts`.
- `expect(result.isSuccess).toBe(...)` failed because `isSuccess` was `undefined`.
- Tests accessing `result.telemetry` and `result.value` failed because these fields were undefined.

## Root Cause
`seedPlanNextPrompts` and `upsertPrompt` API methods return a `ServiceResult<T>` which is a TypeScript `class`.
The `ServiceResult` class exposes properties like `ok`, `data`, and `error`, and getter properties like `get isSuccess()`.
When `ServiceResult` was refactored into a class (previously it might have been a plain object or the getter behavior changed), Playwright's `page.evaluate()` boundary began silently stripping the `isSuccess` getter.
This is because Playwright's serialization of return values across the execution context boundary (from the browser context back to the Node.js test process) uses JSON serialization logic, which only preserves own enumerable properties and strips class prototypes and getters.

Furthermore, `ServiceResult` embeds the success payload inside a `data` field (e.g. `{ ok: true, data: { telemetry: [...] } }`). The test assertions were incorrectly directly accessing `result.telemetry` and `result.value` on the result wrapper, rather than the inner `.data` object, causing tests to fail when the object shape returned by the `api` methods changed.

## Resolution
- Modified the assertions in `seed-plan-next-regression.spec.ts` and `prompt-rename-regression.spec.ts` to check `result.ok` instead of `result.isSuccess`.
- Updated value accessors to read from `result.data`, e.g., changing `result.telemetry` to `result.data.telemetry` and `result.value` to `result.data`.
- Confirmed the E2E tests now properly pass.
