# 33 - Missing coding-guideline compliance (standalone-scripts audit)

Report folder. **Not a spec of new rules** — a diagnostic of where `standalone-scripts/**` deviates from the specs in `spec/02-coding-guidelines/` and `spec/03-error-manage/`.

Owner plan: `.lovable/plans/pending/16-standalone-scripts-coding-guideline-audit.md`
Captured command: `.lovable/spec/commands/01-standalone-scripts-must-follow-coding-guidelines.md`

## Overview

Diagnostic report folder that catalogues where `standalone-scripts/**` deviates from `spec/02-coding-guidelines/` and `spec/03-error-manage/`. Each numbered file is an audit slice (typescript strictness, cross-language style, security, cycles, etc.); `99-summary.json` is the machine-readable rollup and `99-baselines.json` records the CI floors ratcheted by scripts under `scripts/check-*.mjs`.

## Files

- `00-inventory.md` through `13-*.md`: per-audit findings, severity classification, and remediation notes.
- `14-eslint-and-tsc-rule-additions.md`: companion ESLint / tsc rule additions for the P0 items.
- `99-summary.json`: machine-readable rollup (audits, backlog totals, baselines, CI gate list).
- `99-baselines.json`: recorded floors consumed by the `scripts/check-*.mjs` ratchet gates in CI (cycles, unknown occurrences, strict-flag fallout, etc.).

## Why this folder exists

Every package under `standalone-scripts/` (macro-controller Chrome extension + supporting bundles) was authored under evolving guidance. Some files predate the current specs; some post-date them but drift. This folder catalogues the drift so a follow-up remediation plan can attack it in priority order.

## Sources of truth (specs being audited against)

- `spec/02-coding-guidelines/01-cross-language/**` — naming, function length, cognitive complexity, defensive access.
- `spec/02-coding-guidelines/02-typescript/**` — strict typing, `unknown` policy, exhaustive switches, discriminated unions.
- `spec/02-coding-guidelines/08-file-folder-naming/**` — kebab-case filenames.
- `spec/02-coding-guidelines/11-security/**` — DOM sinks, token handling, entropy sources.
- `spec/02-coding-guidelines/24-app-design-system-and-ui/**` — semantic tokens, dark-only theme, no inline hex.
- `spec/03-error-manage/01-error-resolution/**` — no silent catch, context-rich logging.
- `spec/03-error-manage/02-error-architecture/**` — namespace logger contract.
- `spec/03-error-manage/03-error-code-registry/**` — Reason + ReasonDetail coverage.
- Applicable pinned memories: `no-retry-policy`, `timer-and-observer-teardown`, `unknown-usage-policy`, `verbose-logging-and-failure-diagnostics`, `error-logging-via-namespace-logger`, `file-path-error-logging-code-red`, `dark-only-theme`, `auth/unified-auth-contract`, `preferences/test-with-features`.

## Severity ladder

| Level | Meaning | Examples |
|-------|---------|----------|
| P0 | Silent failure, security risk, retry-policy breach, or blocks other refactors | empty `catch{}`, `innerHTML` with user data, `setTimeout` retry loop, god-module cycles |
| P1 | Observability + lifecycle correctness, architectural rework | bare `console.error`, missing teardown, missing `pagehide`, missing Reason+ReasonDetail |
| P2 | Style, structure, typing hygiene, mechanical prune | inline hex in UI, over-long function, `any`, kebab-case violation |

## Headline rollup (all audits, v4.86.0 baseline)

| # | Report | Metric | Value |
|---|--------|--------|-------|
| 00 | inventory | prod `.ts` files under `standalone-scripts/**/src/**` | 514 |
| 00 | inventory | total LOC | ~73,000 |
| 01 | typescript-strictness | `any` in prod | 0 |
| 01 | typescript-strictness | `unknown` occurrences | 261 (see 13 for prod-only 693 across all patterns) |
| 02 | cross-language-style | banned identifier hits (`msg`, etc.) | ≥3 files |
| 03 | file-folder-naming | PascalCase files under `core/` | 1 (`MacroController.ts`) |
| 04 | security-surface | `.innerHTML` sinks | 187 |
| 04 | security-surface | `new Function()` | 1 |
| 05 | design-system-tokens | hex literals in UI | 815 |
| 05 | design-system-tokens | `rgb(a)` literals in UI | ~200 |
| 06 | logger-and-error-manage | unauthorized `console.error` | 4 |
| 06 | logger-and-error-manage | unannotated silent catches | 5 |
| 07 | timer-and-observer-teardown | `setInterval` bypassing tracked registry | 10 / 13 |
| 07 | timer-and-observer-teardown | MutationObservers missing `pagehide` | 7 / 7 |
| 07 | timer-and-observer-teardown | addEventListener:removeEventListener parity | 143:48 (2.98:1) |
| 08 | storage-key-centralization | raw `localStorage` literal keys | 15 across 8 files |
| 08 | storage-key-centralization | auth-critical raw keys | 2 (`marco_bearer_token`, `lovable-session-id`) |
| 09 | test-with-features | prod:test ratio (aggregate) | 508:181 = 0.36 |
| 09 | test-with-features | packages at 0.00 test ratio | 3 (`marco-sdk`, `lovable-common`, `xpath`) |
| 09 | test-with-features | `ui/` coverage | 0.15 (86 of 101 untested) |
| 10 | cognitive-complexity | ESLint rules silenced for standalone-scripts | 2 (`eslint.config.js:326,384`) |
| 10 | cognitive-complexity | files > 1000 LOC | 3 |
| 10 | cognitive-complexity | files > 700 LOC | 12 |
| 11 | import-graph-cycles | circular chains (`macro-controller`) | 57 |
| 11 | import-graph-cycles | circular chains (other 5 packages) | 0 |
| 11 | import-graph-cycles | `export *` barrels | 3 |
| 12 | dead-code | unused exports | 278 across 62 files |
| 12 | dead-code | top offender (`types/index.ts`) | 90 |
| 13 | unknown-usage-top30 | total `unknown` (prod) | 693 |
| 13 | unknown-usage-top30 | `as unknown as` double casts | 95 |
| 13 | unknown-usage-top30 | top-30 files hold | 336 (48.5 %) |
| 99 | backlog | consolidated items | 27 (10 P0 / 11 P1 / 6 P2) |

## File index

- `00-inventory.md` — denominator (514 prod files, ~73k LOC).
- `01-typescript-strictness.md` — `any` / `unknown` / `@ts-*` findings.
- `02-cross-language-style.md` — naming, complexity, function-length, CQ14/CQ15.
- `03-file-and-folder-naming.md` — kebab-case violations.
- `04-security-surface.md` — DOM sinks, token handling, entropy (187 innerHTML, 1 `new Function()`).
- `05-design-system-tokens.md` — hex/rgba/cssText literals in UI (815 hex, ~200 rgba).
- `06-logger-and-error-manage.md` — `console.*` vs namespace logger, silent catches (4 + 5).
- `07-timer-and-observer-teardown.md` — timers/observers without teardown or `pagehide` (10, 7, 143:48).
- `08-chrome-storage-and-local-storage-key-centralization.md` — raw storage keys (15 literals, 2 auth-critical).
- `09-test-with-features-coverage.md` — prod:test ratio + zero-coverage packages (0.36 aggregate, 3 packages at 0.00).
- `10-cognitive-complexity-and-max-lines-per-function.md` — ESLint override + LOC hotspots (2 disables, 3 files > 1000 LOC).
- `11-import-graph-cycles-and-barrels.md` — 57 cycles in `macro-controller`, 3 barrel files.
- `12-dead-code-and-unused-exports.md` — 278 unused exports, top offender `types/index.ts` (90).
- `13-unknown-usage-top30.md` — 693 `unknown` occurrences, 95 `as unknown as` double casts, top-30 files.
- `99-backlog.json` — consolidated P0/P1/P2 queue, 27 items, machine-readable.

## Regeneration

Manually authored across releases v4.80.0 - v4.86.0. A future `scripts/audit-standalone-guidelines.mjs` (tracked by the remediation plan, not this one) will emit `99-backlog.json` from grep+lint output so CI can gate regressions. The baselines above become the CI floor.

## Out of scope

Fixing the violations. Every entry here is diagnostic. Remediation lands in a follow-up plan sequenced from `99-backlog.json` (P0 first, then P1, then P2).
