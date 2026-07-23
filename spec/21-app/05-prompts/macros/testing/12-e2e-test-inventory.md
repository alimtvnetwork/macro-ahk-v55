# E2E Test Inventory (Required)

Total: **10 tests**. Framework: Playwright (manual ban lifted 2026-05-25).

| # | File | Scenario |
|---:|---|---|
| 1 | `happy-path.spec.ts` | run audit→fix→final-audit reaches Score:100 |
| 2 | `loop-if-bounded.spec.ts` | loop hits MaxLoops=5 then aborts cleanly |
| 3 | `sw-restart-idempotent.spec.ts` | mid-prompt restart resumes |
| 4 | `sw-restart-non-idempotent.spec.ts` | mid-audit restart aborts with reason |
| 5 | `new-tab-guard.spec.ts` | start macro on `chrome://newtab/` rejected with E-10 |
| 6 | `tab-busy.spec.ts` | second macro on same tab → E-09 |
| 7 | `sensitive-masking.spec.ts` | ApiToken NEVER appears in _log.jsonl |
| 8 | `audit-files-written.spec.ts` | `spec/audit/<RunId>/01,02,99` exist after run |
| 9 | `keyboard-shortcuts.spec.ts` | Ctrl+Alt+;/. pause/stop active run |
| 10 | `variable-dialog.spec.ts` | required-without-default blocks Submit |

CI gate: `tests:e2e:macros` must report `10 passed, 0 failed`.
