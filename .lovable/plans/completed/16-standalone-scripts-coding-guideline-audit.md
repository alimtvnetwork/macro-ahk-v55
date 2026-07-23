# Standalone-scripts coding-guideline + error-manage audit (completed)

Slug: standalone-scripts-coding-guideline-audit
Steps: 20
Status: completed
Created: 2026-07-27
Closed: 2026-07-17
Releases: v4.80.0 (scaffold) -> v4.87.0 (close-out)

## Outcome

20-step diagnostic audit of `standalone-scripts/**` against `spec/02-coding-guidelines/` and `spec/03-error-manage/`. Zero source-code changes; every deliverable is a machine-readable report or draft rule that feeds a follow-up remediation plan.

## Deliverables (all under `spec/33-missing-coding-guideline/`)

- `readme.md` - scope, methodology, severity ladder, headline rollup table (regenerated v4.87.0).
- `00-inventory.md` - denominator: 514 prod `.ts` files, ~73k LOC.
- `01-typescript-strictness.md` - 0 `any`, 261 `unknown` occurrences (initial count; final prod-wide sweep is 693 in audit 13).
- `02-cross-language-style.md` - banned identifier `msg`, complexity hotspots.
- `03-file-and-folder-naming.md` - 1 PascalCase file (`core/MacroController.ts`).
- `04-security-surface.md` - 187 `.innerHTML` sinks; 1 `new Function()`.
- `05-design-system-tokens.md` - 815 hex + ~200 rgba literals bypass tokens.
- `06-logger-and-error-manage.md` - 4 unauthorized `console.error`; 5 unannotated silent catches.
- `07-timer-and-observer-teardown.md` - 10 `setInterval` bypass registry; 7 observers without `pagehide`; addEventListener:removeEventListener = 143:48.
- `08-chrome-storage-and-local-storage-key-centralization.md` - 15 raw literal keys; 2 auth-critical.
- `09-test-with-features-coverage.md` - aggregate prod:test 0.36; 3 packages at 0.00; ui/ at 0.15.
- `10-cognitive-complexity-and-max-lines-per-function.md` - 2 ESLint rules disabled for standalone-scripts; 3 files > 1000 LOC.
- `11-import-graph-cycles-and-barrels.md` - 57 cycles in `macro-controller` (0 elsewhere); 3 `export *` barrels.
- `12-dead-code-and-unused-exports.md` - 278 unused exports across 62 files; top offender 90.
- `13-unknown-usage-top30.md` - 693 `unknown` prod occurrences; 95 `as unknown as` double casts.
- `14-eslint-and-tsc-rule-additions.md` - draft companion ESLint / tsc rules + 7 CI check scripts, 9-PR staged rollout.
- `99-backlog.json` - 27 items (10 P0 / 11 P1 / 6 P2) with `owner` + `due` per item (12 owner streams).
- `99-baselines.json` - CI floor snapshot at v4.87.0 for future check-* scripts.

## Steps (all completed)

1-6:  Report folder scaffold, inventory, TS strictness, cross-language style, naming, security surface. (v4.80.0 - v4.81.0)
7-8:  Design-system tokens, logger + error-manage. (v4.82.0)
9-10: Timer/observer teardown, storage-key centralization. (v4.83.0)
11-12: Test-with-features coverage, cognitive-complexity + LOC ceilings. (v4.84.0)
13-14: Import-graph cycles + barrels, dead-code + unused exports. (v4.85.0)
15-16: `unknown`-usage top-30, consolidated backlog. (v4.86.0)
17-18: Summary readme regenerate, ESLint/tsc rule draft. (v4.87.0)
19:    Owner + due-date assignment on `99-backlog.json` (12 streams, 27 items). (v4.87.0)
20:    Close-out doc (this file) + `99-baselines.json` snapshot. (v4.87.0)

## Verification (final)

- `node scripts/check-version-sync.mjs` -> green at 4.87.0.
- `node scripts/check-changelog-entry.mjs` -> green for every version 4.80.0…4.87.0.
- Backlog cross-ref: every ID referenced from `14-eslint-and-tsc-rule-additions.md` resolves in `99-backlog.json` (25 refs).
- `python3 -c "import json; d=json.load(open('spec/33-missing-coding-guideline/99-backlog.json')); assert all('owner' in i and 'due' in i for i in d['items']); print(len(d['items']))"` -> 27.
- No source-code changes across the 8 releases (audit + draft-only, per readme).

## Follow-up (not in this plan)

Remediation lives in a new plan referencing `99-backlog.json`. Rollout order is the 9-PR sequence in `14-eslint-and-tsc-rule-additions.md`, each PR paired with the matching `check-*` script from that draft. Baselines in `99-baselines.json` are the CI floor.
