# 19 — Acceptance Matrix

| # | Requirement                                                          | Verified by                            |
|---|----------------------------------------------------------------------|----------------------------------------|
| 1 | Ktlo/Free/Cancelled show correct credits                             | e2e-credit-balance-ktlo, integration   |
| 2 | API called only when inline credits absent                           | e2e-no-fetch-when-inline, controller unit |
| 3 | Default 3 s timeout enforced                                         | controller unit (Timeout case), e2e-timeout |
| 4 | Slider in Macro Controller Settings (min 500, max 15000, step 100)   | settings component test                |
| 5 | `Plan` enum + `GrantType` enum + PascalCase                          | plan-mapper / grant-type-mapper tests  |
| 6 | E2E + integration + unit coverage                                    | sections 16–18                         |
| 7 | No retries beyond the documented single auth retry                   | controller unit (HttpError, 5xx)       |
| 8 | All failures logged via `Logger.error('CreditBalanceUpdate.*', …)`   | logger spy in controller test          |
| 9 | No PascalCase storage migration                                      | code review (IndexedDB store name only)|
|10 | Settings hot-reload (no extension reload required)                   | settings integration test              |
