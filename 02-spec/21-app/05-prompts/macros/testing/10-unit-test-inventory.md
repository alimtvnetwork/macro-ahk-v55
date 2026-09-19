# Unit Test Inventory (Required)

Total: **24 tests**. Framework: vitest.

| # | File | Test |
|---:|---|---|
| 1 | `score-parser.test.ts` | extracts last `Score: NN/100` |
| 2 | `score-parser.test.ts` | rejects out-of-range scores |
| 3 | `score-parser.test.ts` | returns null on no match |
| 4 | `interpolator.test.ts` | resolves tier 1 step-scoped first |
| 5 | `interpolator.test.ts` | resolves tier 5 default last |
| 6 | `interpolator.test.ts` | throws UndeclaredVariable |
| 7 | `interpolator.test.ts` | throws MissingVariable when Required |
| 8 | `interpolator.test.ts` | masks sensitive in log output |
| 9 | `interpolator.test.ts` | rejects path traversal |
| 10 | `interpolator.test.ts` | coerces integer / number / boolean / enum |
| 11 | `interpolator.test.ts` | strips RTL/zero-width chars |
| 12 | `watchdog.test.ts` | aborts task past timeout |
| 13 | `watchdog.test.ts` | clears timer on success |
| 14 | `runner.test.ts` | runs steps in order |
| 15 | `runner.test.ts` | loop-if jumps to GotoStep when score below target |
| 16 | `runner.test.ts` | loop-if exits at MaxLoops |
| 17 | `runner.test.ts` | persists RunState after each step |
| 18 | `runner.test.ts` | rehydrates idempotent step after SW restart |
| 19 | `runner.test.ts` | aborts non-idempotent step after SW restart |
| 20 | `audit-writer.test.ts` | writes 01-gap-analysis.md + 02-findings.json |
| 21 | `audit-writer.test.ts` | writes 99-final-report.md on final-audit |
| 22 | `audit-writer.test.ts` | upgrades v0 payload on read |
| 23 | `state-store.test.ts` | prunes oldest at row cap |
| 24 | `message-bus.test.ts` | drops UnknownMessageType with log |

CI gate: `tests:unit:macros` must report `24 passed, 0 failed`.
