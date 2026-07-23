# Standalone-scripts guideline remediation (spec/33 backlog)

Slug: standalone-scripts-guideline-remediation
Steps: 30
Status: pending
Created: 2026-07-17

## Context

Execute the P0/P1/P2 backlog authored across Plan-16 (v4.80.0 -> v4.88.0) without breaking any runtime behavior. Every step below maps to a specific backlog ID or rollout PR from `spec/33-missing-coding-guideline/14-eslint-and-tsc-rule-additions.md`. Baselines and targets are pinned in `spec/33-missing-coding-guideline/99-baselines.json`; item metadata (owner, due, files, rationale, fix) lives in `spec/33-missing-coding-guideline/99-backlog.json`.

Captured command: `.lovable/spec/commands/02-remediate-spec-33-drift.md`
Related prior audit plan: `.lovable/plans/completed/16-standalone-scripts-coding-guideline-audit.md`
Orthogonal pending plans (NOT pulled in): `10-unified-billing-all-workspaces.md`, `11-prompts-import-export-section.md`, `13-per-project-chat-submit-tracker.md` — each is an independent product workstream and remains untouched.

Non-negotiable operating rules for every step:
- No behavior change. Every PR ships value-locking tests before the refactor lands.
- Follow `mem://preferences/test-with-features`, `mem://auth/unified-auth-contract`, `mem://standards/timer-and-observer-teardown`, `mem://standards/error-logging-via-namespace-logger`, `mem://standards/unknown-usage-policy`, `mem://constraints/no-retry-policy`, `mem://constraints/no-storage-pascalcase-migration`.
- Version bump + changelog entry + release notes + root readme pin per merged release. `check-version-sync.mjs` + `check-changelog-entry.mjs` must remain green.

## Steps

1. Lock behavior with characterisation tests before touching anything: snapshot Plan+Next chip resolution, credit totals aggregation, workspace move, prompt library IO, macro run trigger. Add to `standalone-scripts/macro-controller/src/__tests__/regression-baseline.test.ts`. See `./subtasks/17-standalone-scripts-guideline-remediation/01-characterisation-tests.md`.
2. Introduce the CI check scaffold: `scripts/check-standalone-baselines.mjs` that reads `spec/33-missing-coding-guideline/99-baselines.json` and refuses to let any metric rise. Wire into `npm run precommit` sequentially (no retry). See `./subtasks/17-standalone-scripts-guideline-remediation/02-baseline-check-scaffold.md`.
3. Ship `scripts/check-madge-cycles.mjs` in warn-only mode pinned at 57 for `macro-controller` (0 elsewhere). Prepares PR-A gate.
4. P0-09 cluster 1 first cut: extract `core/controller-state.ts` (pure value module: enums, ids, state shape) out of `core/MacroController.ts` so leaf modules stop importing the controller class. See `./subtasks/17-standalone-scripts-guideline-remediation/03-macrocontroller-extract-state.md`.
5. P0-09 cluster 1 second cut: invert imports for the top 6 fan-out chains (ui/ui-updaters, loop-engine, credit-balance, api-namespace, plan-task-ui, task-next-ui) so they import from `controller-state.ts` not from `MacroController.ts`. Target: reduce cycles from 57 to ≤ 35.
6. P0-09 cluster 2: break `db/macro-db <-> seed/seed-plan-next` (P1-07) by moving `seedPlanNextPrompts()` invocation to a new `db/bootstrap.ts` that imports both. Target: cycles ≤ 25.
7. P1-06 leaf inversion: `logging.ts` becomes a true leaf. Move CSV concerns to `log-csv-export.ts` importing `logging` (not vice-versa). Target: cycles ≤ 15.
8. P2-04 mechanical extraction pass: break the 13 pairwise cycles by extracting shared type/state to a third module per pair. Target: cycles = 0 in `macro-controller`. Flip `check-madge-cycles.mjs` to error mode (PR-A gate live).
9. Enable ESLint `import/no-cycle` for `standalone-scripts/**` (PR-A rule half). Verify with `eslint --max-warnings=0`.
10. P0-01 remediation kickoff: introduce `ui/dom/safe-template.ts` typed template builder + `escapeHtml()` audit helper. Migrate the top 20 `.innerHTML` sinks in `ui/prompt-dropdown.ts`, `ui/projects-modal.ts`, `ui/ws-list-renderer.ts`. See `./subtasks/17-standalone-scripts-guideline-remediation/04-innerhtml-migration-plan.md`.
11. P0-01 remediation completion: migrate the remaining 167 `.innerHTML` sinks in batches by folder (`ui/database-*`, `ui/settings-*`, `ui/section-*`, `ui/panel-*`). Ship value-locking DOM snapshot tests per folder.
12. P0-02: replace `new Function()` in `ui/database-json-migrate.ts` with an explicit dispatch table keyed by migration version. Add unit tests covering every version path.
13. Enable ESLint `no-restricted-syntax` for `innerHTML=` assignment and `new Function()` (PR-B rule). `hexLiteralsInUi` + `rgbLiteralsInUi` gates stay pinned at baseline.
14. P0-06 auth-critical storage keys: extend `types/storage-keys.ts` with `MARCO_BEARER_TOKEN` + `LOVABLE_SESSION_ID`; migrate `auth-resolve.ts:351,352` and every consumer. No behavior change (values identical, key is the same string).
15. P1-04 remaining raw localStorage literals: migrate the 13 sites in `ws-list-renderer.ts`, `workspace-cache.ts`, `ui/ws-filter-menu.ts`, `shared-state-runtime.ts`, `ui/panel-sections.ts`, `ui/section-auth-diag.ts`, `ui/settings-ui.ts`. Ship `scripts/check-storage-key-centralization.mjs` and enable ESLint `no-restricted-syntax` for raw `localStorage(...)` literals (PR-C).
16. P0-03: replace silent IndexedDB catch at `ui/prompt-dropdown.ts:157` with `Logger.error()` carrying `Reason='PromptDropdownDbRead' + ReasonDetail`. Surface via existing error overlay. Add a failing-then-passing test that asserts the log fires.
17. P0-04: eliminate the 4 unauthorized `console.error` sites and annotate the 5 unannotated silent catches. Each legitimate silent catch gets `// reason: <one-liner>` per `mem://standards/error-logging-via-namespace-logger`.
18. Enable ESLint `no-empty` (`allowEmptyCatch: false`) + `no-console` for `standalone-scripts/**` (PR-D). Confirm eslint --max-warnings=0.
19. P0-05 timer registry: migrate the 10 `setInterval` bypass sites (esp. `ui/macro-ui.ts`, `ui/prompt-utils.ts`) to `trackedSetInterval`. Add `pagehide` unwind wired to each owner. Ship `scripts/check-timer-teardown.mjs`.
20. P1-02: add `pagehide` unwind to the 7 MutationObserver owners. P1-03: introduce `trackedAddEventListener` with `AbortController`-per-scope; migrate the top 20 unbalanced listeners so parity drops from 143:48 to ≤ 100:100. See `./subtasks/17-standalone-scripts-guideline-remediation/05-listener-registry.md`.
21. P0-10 Class-C sweep: delete the 95 `as unknown as` double casts. Per-site: extend target type or add runtime guard. Ship `scripts/check-unknown-usage.mjs` with baseline 693 -> target 360. Enable `no-restricted-syntax` for `as unknown` outside `types/**` (PR-E).
22. P1-09 Class-A: introduce `parse<Schema>()` helpers in `credit-fetch.ts`, `ws-move.ts`, `credit-parser.ts`; throw `ApiParseError` on mismatch. Contract tested per endpoint. Removes ~80 `unknown` occurrences.
23. P1-10 Class-B: promote `Record<string, unknown>` namespace bags to named interfaces in `types/project-namespace-shape.d.ts`. Update `api-namespace.ts`, `marco-sdk/src/self-namespace.ts`. Removes ~82 occurrences. `unknown` count now ≤ 400.
24. P1-05 file splits: `ui/prompt-dropdown.ts` (1441 LOC), `ws-list-renderer.ts` (1156), `ui/projects-modal.ts` (1114). Each split by domain (event wiring, rendering, data). Ship `scripts/check-file-loc-ceiling.mjs` (soft 800, hard 1200). See `./subtasks/17-standalone-scripts-guideline-remediation/06-file-split-strategy.md`.
25. P0-08: remove ESLint disables at `eslint.config.js:326,384`; re-enable `max-lines-per-function` (120 default; 60 for db/core; 50 for sdk/common) and `sonarjs/cognitive-complexity` (20). Fix any remaining hotspots inline. PR-F live.
26. P0-07 + P1-11: ship tests for the 3 zero-coverage packages. `marco-sdk`: `getBearerToken()` + auth waterfall. `lovable-common`: dom-utils. `xpath`: core selector. Also lock `repeat-loop-presets.ts` value-set (10,12,15,20,60,75,80,100,200). Ship `scripts/check-test-with-features.mjs` (per-package prod:test ≥ 0.20). PR-G live.
27. P1-08 legacy dead-code triage: per-symbol ripgrep on `auth.ts`, `credit-fetch.ts`, `workspace-rename.ts` — delete unused exports OR reconnect the caller. Cross-check `mem://auth/unified-auth-contract` to confirm nothing legitimate is orphaned. Removes the 33 flagged items.
28. P2-05 barrel prune + P2-03 rename: delete `export *` from `types/index.ts`, `pro-zero/index.ts`, `queue-control/index.ts`, `ui/summary-bar/index.ts`; consumers import from source. Rename `core/MacroController.ts` -> `core/macro-controller.ts` now that P0-09 is done. Enable barrel `no-restricted-syntax` (PR-H). Ship `scripts/check-ts-prune.mjs` with baseline 278 -> target 50.
29. P2-01 + P2-02 + P2-06 cleanup pass: annotate the 261 remaining `unknown` with `// reason: catch|input|opaque-json`; rename banned `msg` identifiers; migrate Class D/E storage + DOM coercion (~69 sites) to typed accessors. `check-unknown-usage.mjs` target reaches ≤ 360.
30. tsconfig strictness + close-out (PR-I): enable `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` one at a time in `tsconfig.macro.build.json`, fix fallout per flag. Final release: bump minor, update changelog / RELEASE_NOTES / root readme, move this plan to `.lovable/plans/completed/17-standalone-scripts-guideline-remediation.md`, snapshot final numbers into `spec/33-missing-coding-guideline/99-baselines.json` under a `postRemediation` block.

## Verification

- `spec/33-missing-coding-guideline/99-baselines.json` targets met at each PR: cycles 57 -> 0 (step 8), innerHTML 187 -> 0 (step 11), `new Function()` 1 -> 0 (step 12), auth raw keys 2 -> 0 (step 14), raw localStorage 15 -> 0 (step 15), silent catches 5 -> 0 (step 17), `console.error` 4 -> 0 (step 17), interval bypass 10 -> 0 (step 19), observer `pagehide` 7 -> 0 (step 20), `as unknown as` 95 -> 0 (step 21), `unknown` 693 -> ≤ 360 (step 29), files > 1200 LOC = 0 (step 24), unused exports 278 -> ≤ 50 (step 28), zero-coverage packages 3 -> 0 (step 26).
- `standalone-scripts/macro-controller/src/__tests__/regression-baseline.test.ts` from step 1 passes at every intermediate step (behavior parity).
- `node scripts/check-standalone-baselines.mjs` green from step 2 onward.
- `node scripts/check-madge-cycles.mjs`, `check-storage-key-centralization.mjs`, `check-timer-teardown.mjs`, `check-unknown-usage.mjs`, `check-file-loc-ceiling.mjs`, `check-test-with-features.mjs`, `check-ts-prune.mjs` all live and green by the time step 30 lands.
- `npx eslint standalone-scripts --max-warnings=0` and `npx tsc --noEmit -p tsconfig.macro.build.json` green at each PR merge.
- `node scripts/check-version-sync.mjs` + `node scripts/check-changelog-entry.mjs` green after each release bump.
- Playwright regression suite (`tests/e2e/seed-plan-next-regression.spec.ts`, `tests/e2e/prompt-rename-regression.spec.ts`) remains green throughout.

## Appended from prior pending tasks

None pulled in. Pending plans `10-unified-billing-all-workspaces`, `11-prompts-import-export-section`, `13-per-project-chat-submit-tracker` are orthogonal product workstreams and stay in `pending/` untouched. If any of them regresses due to this remediation, add a step via a follow-up plan rather than expanding this one past 30.
