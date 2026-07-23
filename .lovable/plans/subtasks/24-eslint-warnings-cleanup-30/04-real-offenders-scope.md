---
Slug: real-offenders-scope
Parent: 24-eslint-warnings-cleanup-30
Status: pending
Created: 2026-07-19
---

# Real offender scope (rescope of steps 3-11)

Uploaded log came from sibling repo `macro-ahk-v55`. This repo's actual `pnpm lint` output (see `.lovable/audits/eslint-baseline-24.json` / `.md`) has different hot files. Plan 24 steps 3-11 are rebound to the offenders below. Step numbers unchanged; targets refreshed.

## Rebinding

| Plan step | Original target | Rebound target(s) | Signal |
| --- | --- | --- | --- |
| 3 | `evaluateAutoAttach` (auto-attach.ts) | `StepGroupLibraryPanel.tsx:173` (1174-line render body) | max-lines: 1174 |
| 4 | `toastPagePayload` | `StepGroupListPanel.tsx:152` (766 lines) | max-lines: 766 |
| 5 | `classifyEntry` + logging test | `WebhookSettingsDialog.tsx:330` (601 lines) | max-lines: 601 + cog:? |
| 6 | `mountDropZoneOverlay` | `StepEditorDialog.tsx:164/251` (396 lines + cog 61) | max-lines: 396; cog: 61 |
| 7 | `failure-logger.ts` (unchanged; already an offender here) | `src/background/recorder/failure-logger.ts:389` (`formatFailureReport` 69 lines / cog 65) plus `buildFailureReport`, `classifyReason` | keep SS-02 |
| 8 | `field-binding-overlay.ts` | `field-binding-overlay.ts:133` (266 lines) + `import-bundle.ts:342` (224 lines / cog 70) | keep SS-03; add SS-05 for import-bundle |
| 9 | `classifyVariable` | `CsvInputDialog.tsx:79` (338) + `csv-parse.ts:49` (cog 53) + `csv-mapping.ts:150` (cog 28) | max-lines + cog |
| 10 | `mountHoverHighlighter` | `RecorderVisualisationPanel.tsx:43` (333) + `RecorderStepDetail.tsx:53` (282) | max-lines |
| 11 | Sweep `background/recorder/**` residual | `live-dom-replay.ts:180` (cog 44), `step-wait.ts:99` (cog 26 + collapsible-if), `url-tab-click.ts:315` (cog 24 + collapsible-if), `http-request-step.ts:96`, `selector-history.ts`, `url-matches-backfill.ts:54`, `step-library/{replay-bridge,result-webhook,input-source,export-bundle}.ts` | mixed |

Steps 12-18 already generic sweeps — remain valid.

## Deferred sub-targets pulled out as their own SS files

- SS-04: `StepGroupLibraryPanel.tsx` decomposition (biggest single file: 5 warnings, 1174+226-line functions).
- SS-05: `step-library/import-bundle.ts` (max-lines 224 + cog 70) — pairs with export/csv-mapping siblings.
- SS-06: `KeywordEventsPanel.tsx` (13 issues across 3 rule kinds; the sole 3-rule offender).

Create those SS files when the corresponding step starts; do not pre-write empty stubs.

## Parse-error cleanup (must happen before step 3)

Two unused `eslint-disable` directives currently break parse-level linting for those files:

- `src/components/options/ProjectDetailView.tsx:1` (`@typescript-eslint/no-explicit-any` disable unused)
- `src/components/options/project-detail/InjectionOrderPreview.tsx:41` (`max-lines-per-function` disable unused)

Delete both directives as part of step 2 wrap-up (single-line edits, no logic change).

## Non-lint but adjacent

- 2 `react-refresh/only-export-components` warnings in `RunResultsSummaryPanel.tsx` — split file into component + helpers module.
- 2 `react-hooks/exhaustive-deps` warnings in `TokenSeederStatusIndicator.tsx` — resolve during step 13 (options sweep part 1).
- 1 `@typescript-eslint/no-explicit-any` still present after removing the unused disable (or not; verify after removal). Assign to step 24.
