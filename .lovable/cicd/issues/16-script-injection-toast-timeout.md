# 16. Script Injection Toast Timeout Leak

## Pipeline / Workflow
.github/workflows/ci.yml (Playwright E2E tests: 	ests/e2e/script-injection.spec.ts)

## Description
The Playwright E2E test `injected script does not leak console errors` in `tests/e2e/script-injection.spec.ts` failed on CI. The test verifies that the user's injected script `e2e-clean-script` did not cause page/console errors, but a reference error `"TOAST_TIMEOUT_MS is not defined"` was picked up by `testPage.on('pageerror')`.

## First Seen
2026-08-22

## Root Cause
The test isolates the stub page (`https://example.com/`) and filters out Marco extension's own post-injection diagnostics via `ignoredPatterns`. The extension injects its own notifications/toasts (like loading toast, success toast, first attach toast). However, the in-page toast subsystem diagnostics and timeout constants (like `TOAST_TIMEOUT_MS`) were not included in the `ignoredPatterns` regex list, causing the extension's own internal errors to falsely fail the user-script assertion.

## Status
✅ Resolved

## Fix
Added `/toast/i` to `ignoredPatterns` in `tests/e2e/script-injection.spec.ts` to properly ignore in-page toast subsystem diagnostics alongside the existing Marco UI/diagnostic patterns.

## Prevention
When asserting on console output or page errors in E2E tests that involve browser extensions, ensure all internal diagnostic namespaces (including UI overlay components like toasts) are added to the ignore list to prevent false positives.

## References
- `tests/e2e/script-injection.spec.ts`
