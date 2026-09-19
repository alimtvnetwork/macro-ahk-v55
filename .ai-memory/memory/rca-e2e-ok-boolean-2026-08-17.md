# RCA: E2E Test Failures (isOk vs ok)

## Issue
Several E2E Playwright tests failed during the CI run:
- `prompt-chip-edit-regression.spec.ts` (Modal remained open after clicking Save, `toHaveCount(0)` failed).
- `prompt-export-import-roundtrip.spec.ts` (Import prompt counts were `0` instead of `2`).

## Root Cause
The `PROJECT_API` handler in the background script (`project-api-handler.ts`) was recently refactored to return the explicit `ok` boolean instead of the legacy `isOk` boolean format. It now returns `{ ok: true, ...result }`.

However, the mocked `chrome.runtime.sendMessage` interceptors in our E2E test suites were still exclusively returning the legacy `{ isOk: true, ... }` format. When the `sql-bridge.ts` adapter parsed these mock responses using `res.ok`, it received `undefined` (which evaluates to `false`). This caused the UI to think all mocked database writes failed, resulting in error toasts and unclosed modals instead of successful save/update flows.

## Resolution
- Ran a script over all `tests/e2e/*.spec.ts` files to update the `RuntimeResponse` and `FakeSqlResp` mock interfaces to include `ok?: boolean`.
- Replaced all mock returns of `isOk: true` with `isOk: true, ok: true` and `isOk: false` with `isOk: false, ok: false` to ensure they seamlessly support both the generic legacy `SAVE_PROMPT` method (which still expects `isOk`) and the `PROJECT_API` rawSql methods (which expect `ok`).
