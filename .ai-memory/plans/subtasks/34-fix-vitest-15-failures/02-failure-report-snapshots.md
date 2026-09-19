---
Slug: failure-report-snapshots
Status: pending
Created: 2026-07-20
Parent: 34-fix-vitest-15-failures
---

# SS-02 FailureReport snapshot drift, 11 cases

## Goal

Green `src/background/recorder/__tests__/failure-report-snapshots.test.ts`. Diagnose per-case whether the emitter regressed or the canonical JSON is stale, then apply the minimum fix.

## Failing cases (per CI log lines 3381-3505)

| # | Test title | Assert line | Suspect |
|---|---|---|---|
| 1 | UrlTabClick, reason=TabNotFound | 119 | emitter added/renamed a field after Plan 30 recorder split |
| 2 | UrlTabClick, reason=InvalidUrlPattern | 119 | same |
| 3 | UrlTabClick, reason=SelectorNotFound | 119 | same |
| 4 | UrlTabClick, reason=UrlPatternMismatch | 119 | same |
| 5 | UrlTabClick, optional fields omitted | 139 | serializer includes an optional field now |
| 6 | Condition wait, Gate ConditionTimeout | 186 | condition-runner refactor changed shape |
| 7 | Condition wait, dedicated ConditionStep failure | 217 | same |
| 8 | XPath/CSS predicate, XPathSyntaxError | 239 | selector-attempt-evaluator em-dash fix may have changed message text |
| 9 | XPath/CSS predicate, CssSyntaxError | 254 | same |
| 10 | XPath/CSS predicate, ZeroMatches predicate | 269 | same |
| 11 | XPath/CSS predicate, ConditionTimeout | 284 | same |

## Procedure (per case)

1. Read the failing `it(...)` block to capture the expected JSON literal.
2. Run only that one case: `pnpm vitest run src/background/recorder/__tests__/failure-report-snapshots.test.ts -t "<title>"`. Copy the actual JSON from Vitest's diff output.
3. Diff expected vs actual. Classify:
   - **Emitter regression:** actual has a wrong field name, missing required field, or wrong Reason code -> fix the emitter (likely `src/background/recorder/failure-logger.ts` or a per-kind builder under `src/background/recorder/step-library/`).
   - **Intentional format change:** actual is correct per the current spec and the JSON literal in the test is stale -> update the literal in place. Explain the change in the Plan 34 Step 5 changelog entry.
4. Never call `--update-snapshots`. Every change must be a hand-edited literal so the diff is reviewable.
5. Preserve field order in the JSON literal to match the emitter's serialization order (matters for readability, not for `toEqual`).

## Verification

- `pnpm vitest run src/background/recorder/__tests__/failure-report-snapshots.test.ts` exits 0.
- The changelog entry for Plan 34 Step 5 lists which cases were "emitter fix" vs "literal update" and why (one line per case).
- No em dashes anywhere in the emitted `FailureReport` payloads (guarded by the Step 4 checker).
