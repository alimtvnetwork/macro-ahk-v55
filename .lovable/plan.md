# Plan: v5.9.0 release + drag-drop import E2E test

Scope: (1) add an end-to-end vitest for the live drag-drop import flow covering replace behavior and validation errors, (2) bump 5.8.0 -> 5.9.0 following the full ceremony so CI stays green, (3) surface remaining follow-ups.

## Part 1 - New E2E test

Target the live path: `standalone-scripts/macro-controller/src/ui/prompt-library-modal.ts` drop zone (not the newer `prompt-import-modal.ts` state machine, which has separate coverage).

New file: `standalone-scripts/macro-controller/src/ui/__tests__/prompt-library-modal-drop-import-e2e.test.ts`

Follow the conventions from `prompt-library-modal-dragover-drop-effect.test.ts`:
- `// @vitest-environment jsdom`
- Mock `../prompt-loader` via `buildPromptLoaderMock`, plus `../../logging`, `../../error-utils`, `../../toast`, `../prompt-cache`, `../prompt-io-db-bridge`, `../../db/prompt-db`
- Keep `parsePromptsText`, `mergePrompts`, `performPromptImport` REAL (do not mock `../prompt-io`) - that is what makes it end-to-end
- Dispatch real `Event('dragover'|'drop', {bubbles, cancelable})` with a stubbed `dataTransfer.files` on `[data-testid="library-drop-zone"]`

Three test cases:

1. Happy path add + replace: seed cache with `[{slug:'alpha', text:'old', isDefault:false}]`. Drop a JSON bundle containing `{slug:'alpha', text:'new'}` and `{slug:'beta', text:'new-b'}`. Assert:
   - `writeJsonCopy` is called with alpha.text === 'new' (replace) and beta present (add)
   - status/toast reports `updated:1, added:1`
   - drop zone re-armed (no `aria-busy=true` leftover)

2. Default-protection guard: seed cache with `[{slug:'plan-default', isDefault:true, text:'canon'}]`. Drop a bundle attempting to overwrite `plan-default`. Assert the row is untouched (text still 'canon') and `results.defaultsProtected >= 1`.

3. Validation errors: drop a `roundtrip.json` File containing malformed JSON (`{ not json`). Assert:
   - `renderImportErrorBanner` output is present (`[data-testid="library-import-error"]` or the banner class the modal uses)
   - `showToast` called with warn/error variant
   - `writeJsonCopy` NOT called
   - Drop zone stays interactive (re-armable) for a follow-up drop

Verification: `bunx vitest run standalone-scripts/macro-controller/src/ui/__tests__/prompt-library-modal-drop-import-e2e.test.ts`

## Part 2 - Minor version bump 5.8.0 -> 5.9.0

Follow the full ceremony from `.lovable/prompts/08-bump-version.md` because the user explicitly said "bump" (that doc's trigger phrase). The narrower `how-to-release.md` (version.json-only) conflicts with it; that conflict is logged as a follow-up (see Part 3).

Files to edit, in order:

1. `version.json` - `version: "5.9.0"`, `releaseDate` and `date` to today's UTC date
2. `standalone-scripts/shared-version.ts` - re-exports `pkg.version`, no manual edit needed; verify only
3. Any hand-pinned version literals surfaced by `grep -rn "5\.8\.0" standalone-scripts src chrome-extension` (should be zero if the single-source-of-truth rule holds; if any exist, update them)
4. `changelog.md` (root) - prepend a new section using the existing format:
   ```
   ## [v5.9.0] YYYY-MM-DD Drag-drop import E2E + minor bump
   
   ### Added
   - `standalone-scripts/macro-controller/src/ui/__tests__/prompt-library-modal-drop-import-e2e.test.ts`: end-to-end coverage for drop-zone replace, default-protection guard, and malformed-JSON validation banner.
   
   ### Fixed
   - (carry the CI-fix items from the previous turn if they were not already released: token-substitute immediate-return, reseed-command extension-bridge mock, etc.)
   ```
   No em dashes anywhere (memory rule + `check-changelog-entry` gate).
5. `readme.txt` and/or root `readme.md` - update any pinned version banner to 5.9.0 if present
6. `standalone-scripts/macro-controller/changelog.md` - add a matching `## v5.9.0 (YYYY-MM-DD)` block scoped to macro-controller changes

CI gates to verify locally before finishing:
- `npx tsc --noEmit -p tsconfig.macro.build.json`
- `npx eslint standalone-scripts --max-warnings=0`
- `node scripts/check-markdown-filenames.mjs` (previously bit v5.7/5.8 releases)
- `node scripts/check-version-sync.mjs` if it exists
- `node scripts/spec/build-index.mjs` then verify `git diff --exit-code spec/21-app/05-prompts/INDEX.json` is clean (spec-gates)
- `bunx vitest run` full suite (target: only the pre-existing `prompt-library-modal-round-trip` parallel-flake failure remains)

## Part 3 - Follow-ups to log under `.lovable/issues/open/`

Create `.lovable/issues/open/16-release-doc-conflict-version-only-vs-full-bump.md`:
- `.lovable/how-to-release.md` says version.json-only; `.lovable/prompts/08-bump-version.md` + `pipeline/06-versioning.md` say full multi-file + changelog + readme
- Neither is marked stale
- Ask user which is canonical, then delete or rewrite the loser

Create `.lovable/issues/open/17-prompt-library-modal-round-trip-parallel-flake.md`:
- `prompt-library-modal-round-trip.test.ts` (2 tests) passes in isolation, fails under parallel vitest due to shared `URL.createObjectURL` global stub bleeding across workers
- Fix: scope the stub to the test's own `window` or use `vi.stubGlobal` inside `beforeEach` + `vi.unstubAllGlobals()` in `afterEach`

Create `.lovable/issues/open/18-two-parallel-import-uis.md`:
- `prompt-library-modal.ts` drop zone (live, ~20 tests) and `prompt-import-modal.ts` state machine (only 1 integration test) both exist
- Confirm which is user-reachable from panel wiring; retire the other or converge tests

Create `.lovable/issues/open/19-workspace-move-v2-live-verification.md`:
- `moveV2` code shipped and typechecks but no live-call proof; verify HTTP verb + body on a real workspace membership before removing PENDING-VERIFY marker

## Technical notes

- Use `vi.hoisted` for `logError`/`showToast` mocks so assertions can inspect calls
- The drop zone accepts JSON only; the malformed-JSON test uses `new File([bad], 'x.json', {type:'application/json'})`
- `results.defaultsProtected` is threaded through `PromptImportResults` (already added in v4.400.0 series)
- The changelog heading style used in the root file is `## [vX.Y.Z] YYYY-MM-DD Title`, NOT the `## vX.Y.Z - YYYY-MM-DD` style from 08-bump-version.md; follow the actual file
- Today's UTC date: use whatever `date -u +%Y-%m-%d` returns at edit time
