---
Slug: http-request-step-refactor
Status: pending
Created: 2026-07-20
Parent: 31-lint-cleanup-ctx-denylist-and-15-line-cap
---

# SS-02 `http-request-step.ts` refactor

Target file: `src/background/recorder/http-request-step.ts`.

## Rename (id-denylist)

Replace `ctx` (36 sites) with a scoped name:
- Inside `executeHttpStep`: `requestContext`
- Inside `buildReplayTrace`: `traceContext`
- Inside header/body helpers: `httpContext`

Do NOT globally sed; rename per lexical scope so each helper reads naturally.

## Function splits (15-line cap)

- `buildReplayTrace` (44L) → extract:
  - `buildReplayTraceHeaders(traceContext)`
  - `buildReplayTraceBody(traceContext)`
  - `buildReplayTraceOutcome(traceContext)`
  Public function becomes a 5-8 line assembler.
- `executeHttpStep` (95L, cc 20 per prior audit) → extract:
  - `prepareHttpRequest(requestContext)`
  - `dispatchHttpRequest(requestContext)`
  - `recordHttpOutcome(requestContext, response)`
  - `recordHttpFailure(requestContext, error)`
  Preserve `DiagnosticError` + `correlationId` propagation.

## Tests

Add unit tests in `src/background/recorder/__tests__/http-request-step.test.ts` for each extracted helper (Vitest + JSDOM). Cover: header assembly, body encoding, outcome logging, failure branch.
