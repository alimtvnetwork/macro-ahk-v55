# ESLint Baseline — Plan 25, Step 1

Captured: 2026-07-19
Command: `npx eslint . -f json`
Raw: `.lovable/audits/eslint-baseline-25.json`

## Totals (initial capture)
- Files with issues: 121
- Warnings: 214
- Errors: 23
- Parse errors: 0 (Plan 25 Step 2 is already satisfied)

## By rule
| Rule | Count |
| --- | --- |
| max-lines-per-function | 178 |
| sonarjs/cognitive-complexity | 24 |
| id-denylist | 23 (cleared this turn -> 0) |
| sonarjs/no-duplicate-string | 6 |
| sonarjs/no-collapsible-if | 2 |
| react-refresh/only-export-components | 2 |
| react-hooks/exhaustive-deps | 2 |

## Diff vs baseline-24
| Rule | 24 | 25 | Delta |
| --- | --- | --- | --- |
| max-lines-per-function | 151 | 178 | +27 |
| sonarjs/cognitive-complexity | 27 | 24 | -3 |
| id-denylist | 8 | 23 | +15 (all cleared in Step 3 this turn) |
| sonarjs/no-duplicate-string | 7 | 6 | -1 |
| parse errors | 2 | 0 | -2 |

The `max-lines-per-function` uptick reflects new controller/hook extractions from Plan 24 SS-04..SS-09 that stayed above the 25-line ceiling; those are targeted by Steps 9-23 below.

## Top 25 offenders — max-lines-per-function
| Lines | File:line |
| --- | --- |
| 327 | src/components/recorder/KeywordEventsPanel.tsx:799 |
| 316 | src/components/recorder/FailureReportsPanel.tsx:80 |
| 282 | src/components/options/recorder/RecorderStepDetail.tsx:53 |
| 282 | src/components/options/StepWaitDialog.tsx:112 |
| 278 | src/hooks/use-step-library.ts:267 |
| 267 | src/components/options/InputSourceDialog.tsx:63 |
| 266 | src/components/recorder/KeywordEventsPanel.tsx:132 |
| 266 | src/components/options/step-group-library/use-step-group-mutations.ts:65 |
| 266 | src/components/options/BatchRunDialog.tsx:90 |
| 266 | src/background/recorder/field-binding-overlay.ts:133 |
| 237 | src/components/options/BatchRenameDialog.tsx:223 |
| 224 | src/background/recorder/step-library/import-bundle.ts:342 |
| 222 | src/components/options/WebhookSettingsDialog.tsx:81 |
| 214 | src/components/recorder/KeywordEventBulkContextMenu.tsx:517 |
| 180 | src/components/options/recorder/use-recorder-visualisation-controller.ts:51 |
| 175 | src/components/options/GroupInputsDialog.tsx:61 |
| 173 | src/components/options/ProjectDetailView.tsx:119 |
| 170 | src/components/options/step-group-list/use-list-panel-mutations.ts:108 |
| 167 | src/background/recorder/recorder-toolbar.ts:130 |
| 158 | src/components/recorder/KeywordEventBulkContextMenu.tsx:111 |
| 152 | src/components/options/StepEditorDialog.tsx:130 |
| 146 | src/components/options/TokenSeederStatusIndicator.tsx:105 |
| 144 | src/components/recorder/KeywordEventsPanel.tsx:487 |
| 144 | src/components/options/step-group-library/use-view-model.ts:59 |
| 141 | src/background/recorder/url-tab-click.ts:315 |

## Top 10 offenders — sonarjs/cognitive-complexity
(Numeric score not surfaced in the message body; sites listed by file:line.)
- src/components/recorder/SelectorTesterPanel.tsx:47
- src/components/recorder/KeywordEventsPanel.tsx:1159
- src/components/recorder/KeywordEventsPanel.tsx:799
- src/components/recorder/KeywordEventsPanel.tsx:712
- src/components/options/step-editor/payload-builders.ts:100
- src/components/options/ProjectDetailView.tsx:119
- src/background/url-trigger.ts:141
- src/background/url-matches-backfill.ts:54
- src/background/recorder/xpath-of-element.ts:33
- src/background/recorder/url-tab-click.ts:315

## Post-Step-3 (this turn)
- id-denylist: 23 -> 0 (renamed `msg` -> `errorMessage` in `use-recorder-visualisation-controller.ts`; renamed `msg`/`el` -> `message`/`nodes`/`node` in the two Playwright specs).
- Total errors: 23 -> 0.
- Warnings unchanged: 214.
- `npx tsgo --noEmit` clean.
