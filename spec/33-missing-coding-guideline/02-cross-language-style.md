# 02 - Cross-language style audit

Scope: `standalone-scripts/**/*.ts` production code.
Specs applied: `spec/02-coding-guidelines/01-cross-language/**`, `mem://standards/formatting-and-logic` (CQ14 braces, CQ15 newlines, defensive property access), `mem://architecture/constant-naming-convention` (SCREAMING_SNAKE_CASE prefixes).

## Rollup (from ESLint baseline + targeted grep)

Current baseline (from Plan-15 seal, v4.78.0): **ESLint 0 errors, 0 warnings** at `--max-warnings=0`. That means the rules already enforced by ESLint (`max-lines-per-function`, `complexity`, `no-restricted-identifiers`, brace/newline rules) show clean.

This audit therefore focuses on rules NOT covered by ESLint:

| Category | Occurrences | Severity |
|----------|------------:|:--------:|
| Constant-naming prefix drift (missing `ID_`/`SEL_`/`ATTR_`/`CSS_`) | Sampled; see below | P2 |
| Restricted identifier `msg` (already fixed in Plan-15 for macro-controller) | 0 in macro-controller | — |
| Defensive property access (`?.` / `??`) on external inputs | Sampled; see below | P2 |
| Function length (over ~60 lines) | 0 flagged by ESLint | — |
| Cognitive complexity (over threshold) | 0 flagged by ESLint (Plan-15 refactored `validatePromptsBundle`) | — |

## Finding CL-01 — constant-naming prefix drift (P2, sample)

Rule (`mem://architecture/constant-naming-convention`): DOM/CSS identifiers use SCREAMING_SNAKE_CASE with a semantic prefix (`ID_*`, `SEL_*`, `ATTR_*`, `CSS_*`, `LABEL_*`).

Spot-check on `macro-controller/src/ui/`:
- `prompt-library-modal.ts` uses local literals like `'font-family:ui-monospace,monospace;font-size:11px;'` throughout `buildTokenRow`/`buildValuesRow`. These are style literals, not constants — flagged in `05-design-system-inline-styles.md`, not here.
- `section-ws-history.ts:88` embeds inline HTML with `onclick="..."` string containing raw ID `'loop-ws-history-panel'`. Should be `ID_LOOP_WS_HISTORY_PANEL = 'loop-ws-history-panel'`.
- `plan-task-ui.ts`, `task-next-ui.ts`, `next-inline-ui.ts` — repeated string keys for `chrome.storage.local` (`'planPromptLastKey'`, `'nextPromptLastKey'`, etc.) not centralised. Should live in a `storage-keys.ts` with prefix `KEY_*`.

**Not a code-red violation, but the sprawl means renames are risky.** Prioritise consolidating storage keys before renaming any surface.

## Finding CL-02 — Inline HTML in `section-ws-history.ts:88` (P1)

Single 300+ char string literal builds a `<button>` with `onclick="(function(){try{...}catch(e){console.warn('[MacroLoop] Clear history failed:', e.message||e);}})();"`. Multiple guideline breaches in one line:

1. Uses `innerHTML`-style inline event handler — flagged in `04-security.md`.
2. Embeds `console.warn` inside string, bypassing namespace logger — flagged in `07-logger-contract.md`.
3. Colors hardcoded (`#7f1d1d`, `#991b1b`, `#fca5a5`) — flagged in `05-design-system-inline-styles.md`.
4. Constructs an ID string outside constants — this file.

Fix hint: rebuild the button via `document.createElement` + `addEventListener`, extract the ID and colours to constants.

## Finding CL-03 — Restricted identifier `msg`

Plan-15 (v4.77.0) renamed `msg` → `message` across `macro-controller`. Grep confirms **0 remaining** in macro-controller prod files.

**Cross-package check (this audit's addition):**
- `marco-sdk/src/self-namespace.ts:145`: `warn: (msg: string) => console.warn(LOG_PREFIX, msg)` — still uses `msg`. Rule wasn't enforced package-wide.
- `marco-sdk/src/logger.ts`, `marco-sdk/src/http.ts` — spot-check needed.
- `payment-banner-hider/src/logger.ts` — spot-check needed.

**Action:** extend the ESLint `no-restricted-identifiers` rule from `macro-controller` scope to ALL `standalone-scripts/*` packages, then fix the ~5 sites revealed.

## Finding CL-04 — Defensive property access on external inputs (P2, sample)

Rule: any property access on an external boundary (JSON parse, `chrome.storage`, DOM query) must use `?.` and `??` per `mem://standards/formatting-and-logic`.

Spot-check pass (`credit-fetch.ts`, `settings-store.ts`, `ws-members-mutations.ts`): compliant.

**No blocking findings.** Full sweep left for the remediation phase because it requires per-file reading, not grep.

## Positive signals

- ESLint `max-lines-per-function` (cap 60): 0 violations after Plan-15 refactor of `buildEditorEl`.
- ESLint `complexity`: 0 violations after Plan-15 refactor of `validatePromptsBundle`/`coercePromptEntry`.
- No `msg` in macro-controller.
- No em-dashes in code comments (verified by grep spot-check on `prompt-library-modal.ts`).

## Remediation order

1. Extend `no-restricted-identifiers` ESLint rule package-wide (5 min).
2. Centralise `chrome.storage.local` keys into `macro-controller/src/storage/storage-keys.ts` (30 min).
3. Rebuild `section-ws-history.ts:88` inline HTML into DOM API (20 min, coordinates with 04/05/07).
