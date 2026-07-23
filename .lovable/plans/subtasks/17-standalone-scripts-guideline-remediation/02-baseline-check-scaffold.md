---
Slug: baseline-check-scaffold
Status: pending
Created: 2026-07-17
Parent: 17-standalone-scripts-guideline-remediation
---

# SS-02 — Baseline check scaffold

Purpose: single CI entry point that reads `spec/33-missing-coding-guideline/99-baselines.json` and fails when any measured metric regresses above baseline (or, once the target column is reached, above target).

## Script

`scripts/check-standalone-baselines.mjs`

## Metrics table

Each metric has a `measure()` implementation:

| metric | measure |
| --- | --- |
| `innerHTMLSinks` | `rg -c "\.innerHTML\s*=" standalone-scripts \| awk '{s+=$1}END{print s}'` |
| `newFunctionSites` | `rg -c "new Function\(" standalone-scripts` |
| `unauthorizedConsoleError` | `rg -c "console\.error" standalone-scripts` minus allowlist |
| `unannotatedSilentCatches` | AST scan (ts-morph) for `catch{}` without `// reason:` comment |
| `setIntervalBypassingRegistry` | `rg` for `setInterval\(` excluding call sites in `interval-registry.ts` |
| `mutationObserversMissingPagehide` | AST: `new MutationObserver` owners with no matching `pagehide` listener |
| `addEventListenerCount` / `removeEventListenerCount` | `rg -c` totals; report ratio |
| `rawLocalStorageLiteralKeys` | `rg -c "localStorage\.(get\|set\|remove)Item\('"` |
| `hexLiteralsInUi` / `rgbLiteralsInUi` | `rg -c` under `ui/**` |
| `macroControllerCycles` | `madge --circular --json` count |
| `exportStarBarrels` | `rg -c "^export \*"` in `**/index.ts` |
| `unusedExports` | `ts-prune -p tsconfig.macro.build.json` count |
| `unknownOccurrencesProd` | `rg` pattern union from audit 13 |
| `asUnknownAsDoubleCasts` | `rg -c "as unknown as"` |
| `filesOver1200Loc` | `find + wc -l` |

## Failure model

Sequential fail-fast per `mem://constraints/no-retry-policy`. On any regression above baseline: log `Reason='StandaloneBaselineRegression'` + `ReasonDetail=<metric>: <observed> > <baseline>`; exit 1. No backoff, no retry.

## Wiring

`package.json` scripts: `"precommit:baselines": "node scripts/check-standalone-baselines.mjs"`. Called from the top-level precommit chain after `check-version-sync` and before `eslint`.
