---
Slug: lint-check
Status: pending
Created: 2026-07-19
Parent: 26-professional-diagnostic-errors-20-step
---

# SS-03 CI lint check for error codes

Script: `scripts/check-error-codes-unique.mjs`.

Fail conditions:
1. Any code appears twice in `errors/error-codes.ts`.
2. A code is `throw`n from more than one file (grep across `standalone-scripts/macro-controller/src`).
3. A `throw` or `Logger.error(` inside `src/**` (excluding `errors/`) lacks a code argument.
4. A `DiagnosticError` throw omits a required context key from the registry.

Wire into `ci.yml` after typecheck. Add unit test `scripts/__tests__/check-error-codes-unique.test.mjs` with fixtures for each failure mode.

ESLint companion: `no-restricted-syntax` banning `NewExpression[callee.name='Error']` in `src/**` outside `errors/`.
