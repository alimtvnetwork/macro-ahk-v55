---
Slug: current-strings-inventory
Status: complete
Created: 2026-07-18
Completed: 2026-07-18
Parent: 14-editable-plan-next-prompt-library
---

# SS-01 - Inventory of current hardcoded Plan / Next prompt strings

Goal: enumerate every call site where the Plan chip and the Next chip inject a prompt body, so steps 15/16 of plan-14 can swap them to `getDefaultPromptForRole()` without missing a path.

## Method

- `rg -n "buildPlanTaskPrompt|injectPlanPrompt|findNextTemplate|DEFAULT_PROMPTS|pasteIntoEditor" standalone-scripts/macro-controller/src/ui/{plan-task-ui,next-inline-ui}.ts`
- Read `plan-task-ui.ts` (197 lines) and `next-inline-ui.ts` (376 lines) end-to-end.

## Findings

| # | File | Line | Chip | Origin of body | Routes via cache? | Tokens present |
|---|------|------|------|----------------|-------------------|----------------|
| 1 | `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts` | 23-87 | Plan | `buildPlanTaskPrompt(n)` string-concat literal in module (`# Plan in ${n}-Steps Plan (v7)...`) | No: literal in module | `${n}` (structural, not a `{{token}}`) |
| 2 | `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts` | 89-97 | Plan | `injectPlanPrompt(n)` -> `pasteIntoEditor(text, ..., 'plan-chip')` | No | as above |
| 3 | `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts` | 165 | Plan | Preset step button click handler -> `injectPlanPrompt(n)` | via #2 | - |
| 4 | `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts` | 191 | Plan | Custom-N `▶` button click handler -> `injectPlanPrompt(n)` | via #2 | - |
| 5 | `standalone-scripts/macro-controller/src/ui/next-inline-ui.ts` | 95-110 | Next | `findNextTemplate(entries, n, ...)` reads `getPromptEntries()` then falls back to `DEFAULT_PROMPTS` from `./prompt-manager` | Yes (cache) with hardcoded fallback | `${N}` slug template |
| 6 | `standalone-scripts/macro-controller/src/ui/next-inline-ui.ts` | 137 | Next | `pasteIntoEditor(combined, ..., 'next-chip')` | Yes | - |
| 7 | `standalone-scripts/macro-controller/src/ui/prompt-manager.ts` | `DEFAULT_PROMPTS` | Next | Hardcoded default set used as final fallback | - | contains `${N}` template |

Duplicates flagged:
- The Plan body lives ONLY in `plan-task-ui.ts` (no cached copy, no seed file yet). Step 8 must migrate this literal to a seed row.
- The Next body has TWO sources: the loaded prompt cache and `DEFAULT_PROMPTS` (`prompt-manager.ts`). Step 8/15/16 must unify to `getDefaultPromptForRole('next')` with `DEFAULT_PROMPTS` demoted to seed-only.

Test/docs copies:
- `standalone-scripts/prompts/13-next-tasks/prompt.md` (canonical dropdown body) - keep as bundled source of truth for seeding.
- `standalone-scripts/prompts/14-plan-steps/prompt.md` (canonical dropdown body) - same.

## Exit criteria

Grep for the first 20 chars of each recorded literal returns only the file:line entries above. `injectPlanPrompt` has 2 call sites (preset + custom); Next has 1 chip-fire path routed through `findNextTemplate`.

## Handoff

- Step 8 (`seedPlanNextPrompts`) will consume the strings in row #1 (Plan) and rows in `DEFAULT_PROMPTS` (Next) as the initial `IsDefault=1` seed rows.
- Steps 15/16 replace rows #2 and #5-6 to route through `getDefaultPromptForRole()`.
