# Component Test Inventory (Required)
Total: **12 tests**. Framework: vitest + @testing-library/react.
| # | File | Test |
|---:|---|---|
| 1 | `RunBanner.test.tsx` | shows Slug + Status |
| 2 | `RunBanner.test.tsx` | renders score chip when ScoreParsed |
| 3 | `RunBanner.test.tsx` | Esc key triggers stop |
| 4 | `VariableInputDialog.test.tsx` | shows fields per declaration |
| 5 | `VariableInputDialog.test.tsx` | disables Submit while invalid |
| 6 | `VariableInputDialog.test.tsx` | Esc cancels |
| 7 | `MacrosTab.test.tsx` | renders empty state with CTA |
| 8 | `MacrosTab.test.tsx` | filters by category chip |
| 9 | `MacroBuilder.test.tsx` | enforces StepKindId 1..8 |
| 10 | `RunHistoryList.test.tsx` | groups runs by day in the user's local timezone tz |
| 11 | `ErrorToast.test.tsx` | role=alert for fatal, status for warning |
| 12 | `KeyboardShortcuts.test.tsx` | ignores shortcuts inside textarea |
CI gate: `tests:component:macros` must report `12 passed, 0 failed`.
