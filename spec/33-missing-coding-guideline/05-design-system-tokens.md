# 05 — Design-System Token Compliance

Scope: `standalone-scripts/**` production `.ts`.
Spec source: `spec/02-coding-guidelines/03-design-system/` (all colours through named tokens), memory `mem://preferences/dark-only-theme`, `mem://features/css-injection-sentinel`.

## Root question (one sentence)
Which inline hex / `rgb(a)` literals in production code bypass the named colour tokens in `macro-controller/src/shared-state.ts` and therefore risk theme drift?

## Method (deterministic, re-runnable)

```bash
cd standalone-scripts
# Inline hex
rg -c --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/__tests__/**' \
  '#[0-9a-fA-F]{3,8}\b' . | sort -t: -k2 -nr
# rgb/rgba literals
rg -c --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/__tests__/**' \
  'rgba?\(' . | sort -t: -k2 -nr
# Files listing (denominator)
rg -l --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/__tests__/**' \
  '#[0-9a-fA-F]{3,8}\b' . | wc -l
```

## Findings

Totals:
- 815 hex literals across 79 production files.
- ~200 `rgb(a)` literals concentrated in the same UI files.
- No dedicated `design-tokens.ts`. The de-facto token module is `macro-controller/src/shared-state.ts` (lines 112-215), which exports `cPrimary`, `cPrimaryLight`, `cPrimaryDark`, `cPrimaryGlow*`, `cLogTimestamp`, `cInputBorder`, `cModalBorder`, `cSeparator`, etc. Its own `|| '#007acc'` fallbacks (lines 112-124, 168) are the only *authorised* hex sites: they are the token defaults.

Top offenders (hex count, prod only):

| File | Hex | rgba | Notes |
| --- | --- | --- | --- |
| `macro-controller/src/shared-state.ts` | 69 | 19 | AUTHORISED: token defaults. **Do not touch.** |
| `macro-controller/src/ui/projects-modal.ts` | 44 | 19 | P0 offender — highest density outside shared-state. |
| `macro-controller/src/ui/prompt-library-modal.ts` | 37 | ? | P0. Recently touched under Plan-15. |
| `macro-controller/src/ws-hover-card.ts` | 34 | ? | P0. Public hover card. |
| `macro-controller/src/ui/prompt-import-modal.ts` | 34 | 16 | P0. Also flagged for `innerHTML` (report 04). |
| `macro-controller/src/ui/macro-ui.ts` | 34 | 12 | P0. Top-level panel chrome. |
| `macro-controller/src/ws-members-panel.ts` | 32 | 18 | P1. |
| `macro-controller/src/ui/section-open-tabs.ts` | 25 | - | P1. |
| `macro-controller/src/ui/ui-status-renderer.ts` | 22 | - | P1. Status colour classes belong in tokens. |
| `macro-controller/src/ui/settings-tab-panels.ts` | 21 | - | P1. |
| `macro-controller/src/ui/credit-totals-modal.ts` | 20 | 17 | P1. |
| `macro-controller/src/ui/bulk-rename.ts` | 20 | - | P1. |
| `macro-controller/src/ui/auth-diag-rows.ts` | 18 | - | P2. Diagnostic UI, low visibility. |
| `macro-controller/src/ui/prompt-dropdown.ts` | 16 | 36 | P1. Highest rgba count in repo. |
| `macro-controller/src/ui/ws-filter-menu.ts` | 15 | - | P2. |

Subtracting the authorised `shared-state.ts` line: **~746 unauthorised hex occurrences across 78 files.**

### Missing tokens
Grep against `shared-state.ts` shows no token for:
- semantic `success` / `warn` / `danger` colours (currently `#22c55e`, `#f59e0b`, `#ef4444` etc. hardcoded in `ui-status-renderer.ts` and toast callers),
- neutral surface ramp (`#0f172a`, `#1e293b`, `#94a3b8`, `#e5e7eb` scattered across modal chrome),
- muted-text / disabled-text pair,
- overlay backdrop opacity (`rgba(0,0,0,0.4)` inline in modals; memory says overlay must be 40% opacity — this value is duplicated instead of tokenised).

### CSS sentinel angle
`mem://features/css-injection-sentinel` documents `#marco-css-sentinel` as the emergency inline dark stylesheet. Inline hex in `.ts` bypasses this sentinel: if the sentinel loads with a different palette, UI panels will look wrong. Tokenising is the fix, not per-file audit.

## Leverage ranking
1. **Extend `shared-state.ts`** with the missing semantic ramps (status, neutral, overlay). Single PR, ~40 LOC. Zero visual change (defaults preserve current hex).
2. **Codemod the top-6 P0 files** (`projects-modal`, `prompt-library-modal`, `ws-hover-card`, `prompt-import-modal`, `macro-ui`, `ws-members-panel` = ~210 hex sites). Replace literals with token imports. Visual regression via existing screenshot tests if available; else manual smoke.
3. **Add ESLint rule** `no-restricted-syntax` banning hex/`rgb(` inside string literals under `standalone-scripts/**/ui/**`, with an allow-list for `shared-state.ts`. Ship after step 2 so it doesn't nuke CI on landing.
4. Handle the remaining 73 files opportunistically as they get touched.

## Not-in-scope
- Font-size / spacing tokens (separate audit, weaker ROI right now).
- Tailwind class review (irrelevant — this is a Chrome extension, no Tailwind runtime in `standalone-scripts/`).
