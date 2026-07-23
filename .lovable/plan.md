## Goal

Close out the Next-chip / minus-button reliability work. Most of the plumbing (sql-bridge retry helper, panel-header de-duplication, task-next DB fallback, gear-menu cache invalidation) landed last turn. This plan covers the remaining gaps the user just called out and verifies the whole chain end to end.

## Scope

1. **Next chip DB fallback (verify + extend)**
  - Confirm `task-next-ui.ts` `selectLegacyTaskNextPrompt` now falls through to `listPromptsByRole('next')` via `runWithBridgeRetry` when the in-memory cache misses.
  - Apply the same fallback + retry pattern to `next-inline-ui.ts` `stageNextPrompt` (the numbered chip path shown in the failing screenshots), so a cache miss or contract-shape error no longer surfaces `PROMPT_LOAD_E001` / `PROMPT_EDIT_E005`.
  - Route the picker (`chip-gear-picker.ts pickPromptFromRole`) through the shared `runWithBridgeRetry` instead of its bespoke retry-once block, so all three entry points behave identically.
2. **Toggle try / rollback**
  - Wrap `panel-layout.ts toggleMinimize` in try / catch that captures the pre-toggle DOM + persisted state, and on failure restores both. Extract `applyMinimizedDom` / `applyExpandedDom` and reuse them from `panel-builder.ts _restoreMinimizedPanel` so boot-time restore and runtime toggle cannot drift.
  - Same treatment for the show / hide path invoked from `panel-header.ts` (hide button), so a failed persistence write cannot leave the panel invisible with no way back.
3. **Hide minus button when no prompts**
  - In `chip-gear-picker.ts` (and wherever the `[-]` chip is rendered next to the numbered chips), query `listPromptsByRole(role)` on render. If the result is empty for that role, hide (`display:none`) the minus / gear affordance instead of rendering a dead control.
  - Re-render (or dispatch a lightweight refresh event) after `setActive`, `deleteCustom`, and prompt-editor save so the chip appears / disappears immediately without a page reload. `invalidatePromptCache()` is already called at those sites, so this hooks into the same points.
4. **UI state refresh after edits**
  - After `prompt-editor.ts` save success and after `chip-gear-menu.ts setActive` / `deleteCustom`, emit a `marco:prompts-changed` custom event on `document`. `chip-gear-picker.ts` and `next-inline-ui.ts` subscribe and re-render their chips. This replaces the current ad-hoc reads and keeps the minus-button visibility rule in step with the DB.

## Verification

- Extend `src/db/__tests__/prompt-load-plan-post-seed-list.e2e.test.ts` with a "next chip, empty cache, DB has the prompt" case and a "next chip, contract error on first call, succeeds on retry" case.
- Add `src/ui/__tests__/chip-gear-picker-empty-role.test.ts` asserting the minus button is hidden when `listPromptsByRole` returns `[]` and reappears after a `marco:prompts-changed` event.
- Add `src/ui/__tests__/panel-layout-toggle-rollback.test.ts` asserting the DOM reverts when the persistence write throws.
- Run the focused suites for `sql-bridge`, `prompt-db`, `task-next`, `next-inline`, `chip-gear-*`, `panel-layout`, `panel-header`. Typecheck touched files.
- Manual check in the extension: click Next 1 / 2 / 3 with an empty in-memory cache; edit a Next prompt from the gear menu and re-click Next; minimize + restore the panel; delete the only prompt in a role and confirm the minus button disappears.

## Technical details

- New event: `document.dispatchEvent(new CustomEvent('marco:prompts-changed', { detail: { role } }))`. Subscribers use `AbortController` for teardown consistent with existing panel listeners.
- `runWithBridgeRetry` already returns whatever `fn` returned; `next-inline-ui.ts` will wrap the DB call and treat `undefined` / empty as "cache miss, fall through to seed toast" instead of throwing.
- Rollback capture in `toggleMinimize`: snapshot `panel.style.cssText`, child visibility, and the current persisted `PanelToggles` before mutation; on catch, reapply snapshot and re-persist. No new persistence format.
- Minus-button visibility lives in the picker render function; guarded by `role in { plan, next, task-next }` so unrelated chips are untouched.  
  
  

  SQL changes you should do. It shouldn't be out of the scope. Why you are saying like it should be out of the scope? Can you please explain? Uh, import, export, some of them are working, some of them are not. There are some issues that make the import, export UI very flexible. Keep one button so that I could have sub-buttons or sub-menu to import, export it. Do not make it very complex. Currently, it's very complex. Okay. This is non-negotiable. You should complete it within it. Is it clear?

## Out of scope

- Any change to the rawSql background contract (locked last turn).
- Import / export scope changes (already shipped user-only).
- The pre-existing 6 unrelated failing tests from the import/export work.