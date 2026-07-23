---
Slug: http-step-and-selectors
Status: pending
Created: 2026-07-20
Parent: 30-refactor-oversized-functions-15-line-cap
---

# SS-05 Refactor `executeHttpStep`, selector-* helpers, logging-handler test

Targets: `executeHttpStep` (95, cc 20), `evaluateOne` (52), `summarise` (45, cc 18), `testSelector` (49), `logging-handler.test.ts` arrow (48), plus remaining offenders discovered in SS-01 inventory.

## Plan

1. `executeHttpStep`: split into `buildHttpRequest`, `sendWithTimeout`, `parseHttpResponse`, `recordHttpOutcome`. All <=15 lines, no-retry policy preserved (`mem://constraints/no-retry-policy`).
2. `selector-comparison.evaluateOne`: extract `resolveMatches`, `scoreCandidate`, `formatSelectorAttempt`. Preserve `SelectorAttempts[]` shape (`mem://standards/verbose-logging-and-failure-diagnostics`).
3. `selector-history.summarise`: extract `bucketHistory`, `rankByRecency`, `pickTopStrategies`.
4. `selector-tester.testSelector`: extract `runSelectorProbe`, `collectDiagnostics`.
5. `logging-handler.test.ts` arrow: split the setup into `arrangeLoggingFixture` and `actAndAssert` helpers; test intent unchanged.
6. Any additional offenders from lint lines 38-346 (uploaded excerpt) handled in the same style.

## Exit criteria

Full `pnpm run lint --max-warnings=0` passes with the 15-line rule enabled repo-wide. Existing tests green.
