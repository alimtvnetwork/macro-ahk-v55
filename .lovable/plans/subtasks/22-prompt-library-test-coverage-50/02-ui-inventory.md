# SS-02 UI Entry Point Inventory

Slug: ui-inventory
Parent: 22-prompt-library-test-coverage-50
Status: completed
Created: 2026-07-17

## ui/plan-task-ui.ts (248 lines)

Exports:
- `buildPlanTaskPrompt(n: number): string` (L26) — pure string builder; templates the Plan prompt with N.
- `renderPlanTaskSubmenu(container, ctx): void` (L126) — DOM writer; wires chip click -> DB read -> substitute -> submit.

Existing coverage: none direct. `configured-chip-values.test.ts` covers chip value derivation but not `buildPlanTaskPrompt`.
Gaps (plan steps 43-44):
- [P] `buildPlanTaskPrompt(3)` contains `{{n}}` -> `3` and preserves surrounding template.
- [N] `buildPlanTaskPrompt(0)` and negative N -> defined behavior (verify current, do not fabricate).
- [I] `renderPlanTaskSubmenu` with a mocked DB returning empty rows fires a `logError` and does NOT submit (step 44 negative path).

## ui/task-next-ui.ts (520 lines)

Exports:
- `taskNextState` (L33) — mutable module state (test hazard: reset between tests).
- `loadTaskNextSettings` (L64), `saveTaskNextSettings` (L83) — chrome.storage round-trip.
- `findNextTasksPrompt` (L119) — resolves the Next prompt body from DB / defaults.
- `findAddToTasksButton` (L182) — DOM lookup.
- `dequeueTaskNextPrompt` (L199) — queue read (existing plan-08 coverage may apply).
- `runTaskNextLoop` (L241), `runTaskNextQueue` (L421) — orchestrators.
- `dispatchTaskNextSubmit` (L335) — DOM submit trigger; single-fire.
- `setupTaskNextCancelHandler` (L477) — teardown-sensitive; regression target for step 46.
- `__resetTaskNextCancelHandlerForTests` (L504) — already provided; use in negative test.

Existing coverage: `task-next-ui-teardown.test.ts` (per prior turn) asserts pagehide teardown.
Gaps (plan steps 45-46):
- [P] `findNextTasksPrompt` reads DB default when present; falls back to hardcoded when DB empty.
- [P] `dispatchTaskNextSubmit` returns true once and dispatches a submit event.
- [N] after `__resetTaskNextCancelHandlerForTests` + pagehide, a second `dispatchTaskNextSubmit` still works (or is a no-op — verify actual, do not fabricate).

## ui/prompt-library-modal.ts (626 lines)

Exports:
- `openPromptLibraryModal()` (L68) — orchestrator; opens modal, wires save/delete/import/export.
- `uniqueDupSlug(baseSlug, existing)` (L618) — pure helper for duplicate-slug naming.

Existing coverage: `prompt-library-modal.test.ts` present (extent TBD when writing step 47/48 tests).
Gaps (plan steps 47-48):
- [I] full flow: seed DB -> open modal -> edit body (tokens preserved) -> save -> chip submits new body.
- [I] import external JSON -> chip submits imported body with substitution.

## Reset hazards flagged for later steps

- `taskNextState` is module-level mutable — every task-next test MUST reset it in `beforeEach`.
- `setupTaskNextCancelHandler` installs global listeners — call `__resetTaskNextCancelHandlerForTests` in `afterEach`.
- `openPromptLibraryModal` appends to `document.body` — use jsdom cleanup or explicit `.remove()`.
