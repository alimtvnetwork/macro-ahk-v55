# Spec-vs-Implementation Gap Report — Task-06

**Task:** cicd-failure-investigation-and-recorder-functionality / Task-06
**Author:** Worker 01 (READ-MOSTLY)
**Date:** 2026-10-15
**Scope:** `02-spec/31-macro-recorder/` (recorder behavior) and
`02-spec/12-cicd-pipeline-workflows/` + `pipeline/01-architecture.md`
through `pipeline/08-troubleshooting.md` (CI/CD contract), diffed against
the working tree.

**Standing caveat:** Recorder repairs are in flight by Worker 02
(Task-03). Every recorder-behavior row below is marked `IN-FLUX` and must
be re-verified at Phase 3. Files were checked for presence only; no
recorder implementation file was read for behavior or modified.

---

## 1. Summary

| Area | YES | PARTIAL | NO | IN-FLUX | Fixed in this run |
|------|-----|---------|----|---------|-------------------|
| Recorder (31-macro-recorder) | 0 | 0 | 0 | 9 | 0 |
| CI/CD pipeline + docs | 6 | 3 | 2 | 0 | 5 |

Recorder rows: all implementation files named by the specs are present in
the tree (12/12 spot-checked), but behavior cannot be asserted against a
stable tree while Worker 02 is editing.

CI/CD rows: the pipeline itself is stable (Tasks 01/02 fixes committed).
The implementation is ahead of its docs — `pipeline/02-ci-workflow.md`
still describes a 6-job CI that no longer exists, and it documents the
old sha-keyed concurrency that Task-01/02 already fixed in `ci.yml`.

---

## 2. Recorder gap table (all IN-FLUX — Worker 02 repairing)

| # | Spec claim (file:section) | Status | Evidence | Action |
|---|---------------------------|--------|----------|--------|
| R1 | Start/pause/resume/stop via `Ctrl/Cmd+Shift+R` shortcut wired in `shortcut-command-handler.ts` + manifest command; recorder-store reducer Idle↔Recording↔Paused (`02-phases.md:Phase 05`) | IN-FLUX | `src/background/shortcut-command-handler.ts` present; `src/background/recorder/recorder-store.ts` present | Re-verify at Phase 3 — Worker 02 repairing |
| R2 | XPath capture engine: strategy priority `id` → `data-testid` → `role+text` → positional; auto-anchor walk over `{LABEL, LEGEND, FIELDSET, FORM}`; `XPATH_CAPTURED` payload with `XPathFull`/`XPathRelative`/`AnchorXPath`/`Strategy`/`SuggestedVariableName` (`06-xpath-capture-engine.md`) | IN-FLUX | `src/content-scripts/xpath-recorder.ts` present | Re-verify at Phase 3 — Worker 02 repairing |
| R3 | Capture-to-step bridge: `RECORDER_CAPTURE_PERSIST` builds `StepDraft` from capture payload, `StepKindId` inferred from `TagName` (`input`/`textarea` → Type, `select` → Select, else Click), `findAnchorSelectorId` anchor lookup (`13-capture-to-step-bridge.md`) | IN-FLUX | `src/background/recorder/capture-to-step-bridge.ts` present; `src/background/handlers/recorder-capture-handler.ts` present | Re-verify at Phase 3 — Worker 02 repairing |
| R4 | Step persistence: `OrderIndex = MAX+1`, variable-name uniqueness, exactly one `IsPrimary = 1`, `AnchorSelectorId` only valid on relative selectors, FK cascade delete; replay resolver with depth cap 16 + cycle guard (`09-step-persistence-and-replay.md`) | IN-FLUX | `src/background/recorder/step-persistence.ts` present; `src/background/recorder/replay-resolver.ts` present | Re-verify at Phase 3 — Worker 02 repairing |
| R5 | CSV/JSON data-source drop zone: RFC-4180 subset CSV parser + JSON-array parser, `RECORDER_DATA_SOURCE_ADD`/`LIST` (`07-data-source-drop-zone.md`) | IN-FLUX | Backend files present under `src/background/recorder/`; drop-zone overlay UI deferred per spec | Re-verify at Phase 3 — also owned by Task-05 (Worker 02) |
| R6 | Custom edit operations: `RECORDER_STEP_RENAME` + selectors-list backend, `updateStepVariableName` with uniqueness + empty-name guards (`02-phases.md:Phase 10`) | IN-FLUX | Components under `src/components/` per spec; `src/hooks/use-recorder-project-data.ts` named in spec | Re-verify at Phase 3 — Worker 02 repairing |
| R7 | Replay semantics: `RECORDER_STEP_RESOLVE` returns primary selector; anchor-chain resolution; deterministic replay contract (`09-step-persistence-and-replay.md:§4`, `12-record-replay-e2e-contract.md`) | IN-FLUX | Handler named in spec; resolver file present | Re-verify at Phase 3 — Worker 02 repairing |
| R8 | Record→replay E2E contract: 1 project + 1 CSV + 3 steps + replay; executable Playwright suite deferred per `mem://preferences/deferred-workstreams.md` (`12-record-replay-e2e-contract.md`) | IN-FLUX | Deferral is spec-acknowledged, not a code gap | Follow-up: Task-04 (Worker 01) owns the E2E run |
| R9 | Deferred producer wiring: content-script forwarding of `XPATH_CAPTURED` as `RECORDER_CAPTURE_PERSIST` pending Shadow-Root toolbar UI (`13-capture-to-step-bridge.md:Deferred`) | IN-FLUX | Spec-acknowledged deferral | Follow-up: lead to schedule with toolbar UI workstream |

---

## 3. CI/CD gap table (verified against working tree)

| # | Spec claim (file:section) | Status | Evidence | Action |
|---|---------------------------|--------|----------|--------|
| C1 | CI is "structured as 6 jobs" (`pipeline/02-ci-workflow.md`) | NO | `.github/workflows/ci.yml` defines ~35 jobs (`spec-links`, `markdown-filename-policy`, `blind-ai-audit-guards`, `no-nested-template-literals`, `eslint-run-summary-types`, `contract-checkers-wired`, `cicd-index-sync`, `madge-cycles-floor`, `strict-flag-fallout`, `p0-rules-audit`, `pascalcase-instruction-migration`, `report-standalone-registry`, `readme-conventions`, `typecheck-standalone`, `typecheck-app`, `typecheck-clean`, `lint-standalone`, `setup`, `build-sdk`, `build-xpath`, `casing-checker-self-test`, `casing-instruction-json`, `casing-prompt-info`, `import-export-e2e`, `build-extension`, `verify-built-manifest-csp`, `e2e`, `e2e-02-extended`, `e2e-23-multi-tab-sync`, `build-marco-sdk`, `build-lovable-common`, `build-lovable-owner-switch`, `build-lovable-user-add`, `build-lovable-dashboard`, `build-prompt-manager`, …) | Follow-up: doc rewrite of `pipeline/02-ci-workflow.md` (too large for a small fix) |
| C2 | Build DAG order SDK → XPath/Controller/Prompts → Extension with artifact passing (`pipeline/02-ci-workflow.md`, `pipeline/05-build-chain.md`, `pipeline/03-release-workflow.md`) | YES | `ci.yml:1213` (`setup`), `ci.yml:1284` (`build-sdk`), `ci.yml:1350`/`1442`/`1503` (`build-xpath`), `build-extension` at `ci.yml:2244`; `05-build-chain.md` chain commands match `package.json` script chains | None |
| C3 | Concurrency: new push cancels in-flight runs (`pipeline/02-ci-workflow.md`) | PARTIAL | `ci.yml:39-40`: `group: ci-${{ github.workflow }}-${{ github.ref || github.sha }}`, `cancel-in-progress: ${{ !startsWith(github.ref, 'refs/tags/') }}` — behavior correct (fixed in Task-01/02), but the doc still prints the old `ci-main-${{ github.sha }}` snippet that could never cancel | Fixed in this run: doc snippet updated |
| C4 | Zero-storage rule: no `actions/upload-artifact` for build intermediates (`AGENTS.md` §7; `pipeline/` contract) | NO | `ci.yml` uses `actions/upload-artifact@v4` 16× (`ci.yml:1273`, `1350`, `1442`, `1503`, `1599`, `2229`, `2505`, `2656`, `2664`, `2752`, `2844`, `2886`, `2916`, `2946`, `2976`, `2996`, `3016`) for sdk-dist/xpath-dist/macro-controller-dist/prompts-dist passing; `pipeline/02-ci-workflow.md` and `pipeline/03-release-workflow.md` document this as the design | Follow-up: lead decision required — migrate inter-job passing to cache/restore or amend the house rule; not a small fix |
| C5 | Release assets attached via GitHub Release are exempt from zero-storage (`AGENTS.md` §7) | YES | `.github/workflows/release.yml:124,937` uses `softprops/action-gh-release@v2`; `pipeline/03-release-workflow.md` documents the same action | None |
| C6 | Tests run via Vitest single pass in `setup` job (`pipeline/02-ci-workflow.md`) | YES | `package.json:56` `"test": "vitest run"`; `ci.yml` `setup` job runs the suite | None |
| C7 | Lowercase `.md` filenames enforced in CI (`pipeline/02-ci-workflow.md`) | PARTIAL | Policy enforced, but mechanism is `node scripts/check-markdown-filenames.mjs` in the `markdown-filename-policy` job (`ci.yml:81`), not the documented `find + grep` in `setup` | Fixed in this run: doc cell updated |
| C8 | Companion Workflows table covers every companion workflow (`pipeline/03-release-workflow.md`; pinned by `scripts/__tests__/pipeline-docs-vs-ci.test.mjs`) | NO | Test failed: table missing `` `prompt-manager-desktop.yml` `` (name: "Build prompt-manager desktop app", triggers `prompt-manager-v*` tags + dispatch) | Fixed in this run: row added; test passes |
| C9 | `spec-gates.yml` / `spec-audit.yml` enforce spec structural gates | YES | `spec-gates.yml`: perf-budget, verify-no-hardcoded-repo, spec-xref, spec-index, runbook-smoke, tooltip-dict-gate, smoke-rescore; `spec-audit.yml`: 14 blind-AI audit checkers; both trigger on push + PR | None |
| C10 | Doc links resolve to existing paths (no `spec/` or `.lovable/` rot) | PARTIAL | `spec/` and `.lovable/` do not exist at repo root. Stale refs found and fixed: `pipeline/02-ci-workflow.md:145` (`spec/2026-spec/…` → `02-spec/2026-spec/…`), `pipeline/06-versioning.md` (`.lovable/how-to-release.md` → `.ai-memory/how-to-release.md`), `ci.yml:47` comment ("under spec/" → "under 02-spec/"), `spec-gates.yml` comment (`.lovable/memory/…` → `.ai-memory/memory/…`) | Fixed in this run (4 files) |
| C11 | `source maps never shipped` triple enforcement (`pipeline/03-release-workflow.md`) | YES | Doc claims build-config `sourcemap: false` + verification gate failing the pipeline on `.map` files + safety-net deletion; `ci.yml` contains `verify-built-manifest-csp` (`ci.yml:2532`) and the doc-level chain is internally consistent | None (config-level re-verification belongs to a build audit) |

---

## 4. Fixes applied in this run (all minimal, no reflow)

1. `pipeline/03-release-workflow.md` — added missing
   `` `prompt-manager-desktop.yml` `` row to the Companion Workflows
   table. `scripts/__tests__/pipeline-docs-vs-ci.test.mjs` now passes.
2. `pipeline/02-ci-workflow.md` — fixed stale `spec/2026-spec/…` link to
   `02-spec/2026-spec/…` (target verified to exist).
3. `pipeline/02-ci-workflow.md` — concurrency snippet updated from the
   old `ci-main-${{ github.sha }}` to the actual
   `ci-${{ github.workflow }}-${{ github.ref || github.sha }}` with the
   tag exception noted.
4. `pipeline/02-ci-workflow.md` — setup-job table cell corrected from
   `` `find + grep` `` to
   `node scripts/check-markdown-filenames.mjs` (markdown-filename-policy job).
5. `pipeline/06-versioning.md` — `.lovable/how-to-release.md` corrected
   to `.ai-memory/how-to-release.md` (verified present).
6. `.github/workflows/ci.yml` (comment only) — Job 0 comment corrected
   from "under spec/" to "under 02-spec/".
7. `.github/workflows/spec-gates.yml` (comment only) — stale
   `.lovable/memory/features/release-pipeline-repo-url-agnostic.md`
   corrected to `.ai-memory/memory/features/release-pipeline-repo-url-agnostic.md`
   (verified present).

Boolean conventions respected (no boolean prose touched); no em-dashes
introduced in any edited file.

---

## 5. Follow-ups (out of scope for this run)

- **F1.** Rewrite `pipeline/02-ci-workflow.md` job inventory: it still
  documents 6 jobs while `ci.yml` has ~35 (row C1). Lead-owned doc work.
- **F2.** Zero-storage conflict: `actions/upload-artifact@v4` used 16×
  in `ci.yml` for inter-job dist passing vs the AGENTS.md §7 total ban
  (row C4). Needs a lead decision: migrate to `actions/cache` or amend
  the house rule. Not a small fix; do not attempt unilaterally.
- **F3.** Recorder behavior rows R1–R9: re-verify at Phase 3 after
  Worker 02 completes Task-03/Task-05.
- **F4.** Stale `spec/` → `02-spec/` references inside
  `02-spec/31-macro-recorder/` docs (16 hits, e.g.
  `97-acceptance-criteria.md` lines 4, 8, 59, 74, 77;
  `llm-guide.md` lines 52, 229–246; `02-phases.md:34`;
  `03-data-model.md:12`; `04-per-project-db-provisioning.md:16–17`;
  `16-step-group-library.md:111`). Left untouched: recorder-spec
  territory, bulk edit not "small"; suggest the strict spec-link checker
  (`scripts/report-spec-links-ci.mjs`) be confirmed to cover these so CI
  pins them.
- **F5.** `pipeline/08-troubleshooting.md` entries predate the current
  CI (no entry for spec-link failures, casing checkers, or the
  markdown-filename policy). Consider appending entries as new failure
  modes are observed.
- **F6.** `pipeline/03-release-workflow.md` "Actions Versions" table
  lists `actions/upload-artifact`/`download-artifact` v4 without noting
  the zero-storage tension (see F2).
