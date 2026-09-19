# 06 — Logger & Error-Manage Audit

Scope: `standalone-scripts/**` production `.ts`.
Spec source: `spec/03-error-manage/**`, memory `mem://standards/error-logging-via-namespace-logger`, `mem://standards/error-logging-requirements`, `mem://constraints/file-path-error-logging-code-red`, `mem://features/error-swallow-audit-generator`.

## Root question (one sentence)
Do all runtime failures reach a namespace-aware logger with contextual detail (path, missing item, reason), or are any swallowed / re-raised as bare `console.error`?

## Method (deterministic, re-runnable)

```bash
cd standalone-scripts
# Bare console.* in production
rg -c --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/__tests__/**' \
  'console\.error\(' . | sort -t: -k2 -nr
rg -c --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/__tests__/**' \
  'console\.warn\(' . | sort -t: -k2 -nr
rg -c --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/__tests__/**' \
  'console\.log\(' . | sort -t: -k2 -nr
# Silent catches (with & without allow-swallow annotation)
rg -Un --no-heading --pcre2 -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/__tests__/**' \
  'catch\s*\([^)]*\)\s*\{\s*/\*(?!.*allow-swallow).*?\*/\s*\}' .
rg -c --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/__tests__/**' \
  'allow-swallow' .
```

## Findings

### Bare `console.error` — 10 production files, 15 sites
| File | Count | Verdict |
| --- | --- | --- |
| `marco-sdk/src/logger.ts` | 3 | **AUTHORISED** — this IS the logger's final sink. |
| `payment-banner-hider/src/logger.ts` | 2 | **AUTHORISED** — package-local logger sink. |
| `macro-controller/src/logging.ts` | 2 | **AUTHORISED** — logger internals. |
| `macro-controller/src/error-utils.ts` | 2 | **AUTHORISED** — error-formatting helper's fallback. |
| `lovable-common/src/logger.ts` | 2 | **AUTHORISED** — logger sink. |
| `lovable-dashboard/src/logger.ts` | 1 | **AUTHORISED** — logger sink. |
| `macro-controller/src/user-gesture-guard.ts` | 1 | **P1** — should route through namespace logger. |
| `macro-controller/src/queue-control/auto-resume.ts` | 1 | **P1** — critical loop path; needs namespace + Reason/ReasonDetail per `mem://standards/verbose-logging-and-failure-diagnostics`. |
| `macro-controller/src/credit-api.ts` | 1 | **P0** — network failure path with no `Reason` / `ReasonDetail`. Violates the mandatory failure-log shape memory. |
| `macro-controller/src/core/MacroController.ts` | 1 | **P0** — top-level controller, silent to end user without namespace logger. |

Net unauthorised: **4 sites** (P0×2, P1×2). Exact file+function lookup needed before fix.

### `console.warn` — top files
`startup-idempotent-check.ts` (9), `startup-domain-guard.ts` (3), `marco-sdk/src/http.ts` (2), `ui/prompt-utils.ts` (2). Startup warns are borderline acceptable (namespace logger may not be ready yet), but each should still be reviewed against the "startup logger fallback" pattern used elsewhere in `startup.ts`.

### `console.log` — top offenders
`marco-sdk/src/http.ts` (7), `marco-sdk/src/self-namespace.ts` (4), `startup-idempotent-check.ts` (4). None should ship in prod — either delete or gate behind `VerboseLogging`.

### Silent catches
- **17 annotated `allow-swallow` markers** across 12 files. Each pairs with an inline reason (e.g. `startup.ts:107` "UI may not be mounted yet"). These are compliant with the swallow-audit generator (`mem://features/error-swallow-audit-generator`).
- **4 unannotated swallow sites** flagged by grep:
  - `visible-workspaces-store.ts:37` — `try { cb(lastRows); } catch (_e) { /* see publish */ }`. **P1**. Comment defers to another site; needs the same `allow-swallow: <reason>` marker.
  - `ui/ui-updaters.ts:215` — `catch (_e) { /* dom-cache may be unavailable in tests */ }`. **P1**. Needs `allow-swallow:` prefix so the audit generator classifies it.
  - `ui/ui-updaters.ts:223` — `catch (_e) { /* namespace may already be torn down */ }`. **P1**. Same.
  - `startup.ts:358-360` — `/* Non-critical startup check */`. **P1**. Same.
  - `ui/prompt-dropdown.ts:157` — `.catch(function() { /* swallow — IDB hydration is best-effort */ })`. **P0**. Best-effort IDB hydration MUST at least log at `warn` level with the DB name and error message; a silent IDB miss becomes an "empty prompts library" support ticket.

### `lovable-dashboard/**` — catch(caught) with early return, no log
`workspace-dictionary.ts:15`, `url-guard.ts:15/24`, `search-bar.ts:22`, `nav-controls.ts:18/75`, `macro-sync.ts:17`. Each returns a safe default (`emptyDictionary()`, `false`, no-op unsubscribe, `null`) with no log. **P1** — matches the "silent failure" pattern the memory explicitly bans; these files use `caught` variable then discard it. Fix: log at `warn` with `Reason='<GuardBailout>'` before returning the safe default.

### Missing failure-log shape
No occurrence of the mandatory `Reason` + `ReasonDetail` + `SelectorAttempts[]` + `VariableContext[]` schema (per Core memory) in any of the files above. That schema is currently applied only inside the recorder failure builder (`buildJsStepFailureReport`); coding-guideline-adjacent modules never construct it. This is a spec-vs-reality gap, not a bug per se, but every P0/P1 above should adopt at least the `Reason` + `ReasonDetail` pair.

## Leverage ranking
1. **Fix the 4 P0/P1 unannotated swallows** (`prompt-dropdown.ts:157`, `ui-updaters.ts:215/223`, `visible-workspaces-store.ts:37`, `startup.ts:358`). Either add `allow-swallow: <reason>` OR add a `Logger.warn(...)` with reason. ~30 min.
2. **Route the 4 unauthorised bare `console.error` sites** (`credit-api.ts`, `MacroController.ts`, `auto-resume.ts`, `user-gesture-guard.ts`) through the namespace logger with `Reason` + `ReasonDetail`. ~1 hour.
3. **Audit `lovable-dashboard/**` catch-swallow-return pattern** (6 sites). Add package-local logger warn. ~30 min.
4. **Add ESLint rule** `no-console` scoped to `standalone-scripts/**` with an allow-list of the 6 authorised logger files. Ship after 1-3 land. ~15 min.
5. **Add lint check** for `catch (` followed within 3 lines by `{` and `}` with no `Logger.` / `logError` / `throw` / `reject` / `allow-swallow` between. This is the audit-generator's job (`mem://features/error-swallow-audit-generator`); confirm its P0/P1/P2 classifier is picking these up, extend if not.

## Not-in-scope
- Recorder failure-log schema (already covered by `buildJsStepFailureReport` memory).
- Webhook fail-fast policy (per `mem://constraints/webhook-fail-fast`, no retry semantics to audit here).
