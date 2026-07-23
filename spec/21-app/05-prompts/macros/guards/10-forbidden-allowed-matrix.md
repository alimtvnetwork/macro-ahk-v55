# Forbidden / Allowed Matrix

Hard invariants. Violations MUST fail CI (`scripts/audit-spec-compliance.mjs`).

| Surface | Forbidden | Allowed |
|---|---|---|
| Storage | `localStorage` for run state | `chrome.storage.local` keyed `Macro.RunState.<RunId>` |
| Storage | Renaming `StoredProject` keys (Phase 2c PascalCase migration) | Identity-only framework reads/writes |
| Auth | Supabase SDK, Supabase URLs, anon keys | `getBearerToken()` waterfall |
| Auth | Hardcoded credentials | Bearer token from auth bridge |
| Retry | Recursive retry, exponential backoff | Sequential fail-fast |
| Webhook | Retry queue, scheduled redelivery | Single attempt + log |
| Color | `text-white`, hex codes, raw `rgb()` in components | Semantic tokens (`13-css-tokens.md`) |
| Theme | Light mode, theme toggle | Dark-only |
| Logging | `console.log(err)` | `RiseupAsiaMacroExt.Logger.error(...)` |
| Types | `unknown` in function params | Designed types; `CaughtError` only |
| Errors | Swallowed catches | `Logger.error` + `Reason` + `ReasonDetail` |
| readme.txt | Time/clock/timestamp/git-update writes | One-shot explicit user-requested writes only |
| Injection | Run on `about:blank`, `chrome://newtab/`, etc. | `isNewTabOrBlankUrl()` gate must pass |
| Variables | Logic in `{{ }}` (helpers, conditionals) | Pure name substitution |
| Variables | Render sensitive value in logs | `***` masking enforced |
| Audit | Write outside `spec/audit/<RunId>/` | Inside that folder only |
| Loops | `MaxLoops > 20` | Capped at 20 |

## CI gates

- `lint:no-supabase` (rg patterns)
- `lint:no-local-storage-runstate`
- `lint:no-pascalcase-rename`
- `lint:no-color-literals`
- `lint:no-explicit-unknown`
- `tests:ci-workflow-trigger-policy`
