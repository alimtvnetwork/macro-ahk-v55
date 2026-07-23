---
Slug: refactor-patterns-catalog
Status: completed
Created: 2026-07-20
Completed: 2026-07-20
Parent: 30-refactor-oversized-functions-15-line-cap
---

# SS-02 Refactor patterns catalog

Reusable patterns applied across all refactored files so behavior is preserved and reviews are mechanical. Confirmed against SS-01 inventory (3,796 offenders across 1,236 files); the eight patterns below cover every cluster identified.

## Patterns

1. **Shell + Wire** — `mountX()` becomes `mountX = () => wireX(buildXShell())`. `buildXShell` is pure DOM construction and returns `{ root, refs }`; `wireX` attaches listeners and observers. Applies to every `standalone-scripts/macro-controller/src/ui/*` modal, dropdown, and panel (SS-01 cluster 1).
2. **Async pipeline** — `executeStep()` decomposes into `prepare -> resolveTarget -> perform -> record -> finalize`; each stage <= 15 lines; the orchestrator sequences them and owns the diagnostic envelope. Applies to `live-dom-replay.executeStep`, `executeHttpStep`, and `step-library/run-group-runner` (SS-01 clusters 2 and 3).
3. **Guard clauses first** — replace nested `if/else` chains with early returns to shed cognitive complexity before counting lines. Applied before every extraction so the resulting helpers stay linear.
4. **Config-object params** — helper functions receive `{ context, logger, correlationId }` (or a purpose-built shape) instead of 4+ positional args. Prevents parameter fan-out in the extracted helpers.
5. **Table dispatch** — switch statements over `StepKindId` / action kind replaced with a `Record<Kind, Handler>` map; each handler is its own <= 15-line function. Applies to `step-library/import-bundle`, `step-library/export-bundle`, selector-strategy resolution.
6. **Event-handler extraction** — inline arrow listeners promoted to named module-scope handlers with typed `event` params. Applies to recorder-toolbar, hover-highlighter, dropzone-overlay, and every UI panel with click/keydown handlers.
7. **Error surface** — every extracted helper throws or returns a `DiagnosticError` (per `standalone-scripts/macro-controller/src/error-codes.ts`); no swallowed catches; `Reason` + `ReasonDetail` preserved (per `mem://standards/verbose-logging-and-failure-diagnostics`).
8. **Test arrange/act/assert** (new, added after SS-01) — long test bodies are split into `arrangeXFixture()`, `actY(fixture)`, `assertZ(result)` helpers so no `it()` / `describe.each` arrow exceeds 15 lines. Applies to the ~400 offenders under `**/__tests__/` including `instruction-failure-adapters.test.ts` (22 offenders) and `logging-handler.test.ts`.

## Cluster -> pattern mapping (from SS-01)

| Cluster | Pattern(s) | Files touched (representative) |
| ------- | ---------- | ------------------------------ |
| UI modals/panels | 1, 3, 6 | prompt-library-modal, settings-tab-panels, prompt-history-panel, ws-members-panel, projects-modal, credit-totals-modal, prompt-dropdown, repeat-loop-ui |
| Recorder mounts | 1, 3, 6 | recorder-toolbar, hover-highlighter, dropzone-overlay |
| Async executors | 2, 3, 4, 7 | live-dom-replay, http-request-step |
| Step-library dispatch | 4, 5, 7 | import-bundle, export-bundle, run-group-runner |
| Selector helpers | 3, 4 | selector-comparison, selector-history, selector-tester |
| Shared libs | 3, 4 | src/lib/sqlite-bundle.ts |
| Tests | 8, 3 | all `**/__tests__/*.test.ts` offenders |

## Non-negotiables

- Zero behavior change. Existing tests must pass unchanged; new tests only expand coverage of extracted helpers.
- No renaming of public exports (import sites stay stable).
- Preserve `correlationId` propagation and `Reason` + `ReasonDetail` logging shape end-to-end.
- Restricted-identifier rules stay in force (no `el`, `fn`, `cb`, `arr`, `msg`); extracted helpers use intent-revealing names.
- Strict-flag ratchet cannot regress: `dataset` and other index-signature reads keep bracket notation (per `mem://standards/restricted-identifiers-and-function-size`).

## Exit criteria

Met: patterns confirmed against real offender clusters, cluster -> pattern mapping recorded, non-negotiables aligned with project memory. SS-03/04/05 refactors will cite the pattern numbers above so reviews are mechanical.
