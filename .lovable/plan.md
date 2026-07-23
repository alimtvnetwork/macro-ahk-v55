# Fix minus-button hide toggle and Next-button prompt navigation

Two independent bugs live in `standalone-scripts/macro-controller/src/ui`. Both are structural: state and DOM drift apart, and the Next chip reads from an in-memory legacy cache that the write path never invalidates.

## Bug 1: minus / hide toggle desync

**Where**: `ui/panel-layout.ts:427-465` (`toggleMinimize`), `ui/panel-header.ts:98-127` (title-row + span click), `ui/panel-builder.ts:277-294` (`_restoreMinimizedPanel`).

**Symptoms**:
- Clicking the `[-]`/`[+]` span *and* the title row can both fire `toggleMinimize` on the same click on some pointer sequences (double-toggle → visible state doesn't match label).
- If a DOM mutation in the hide/show loop throws partway, `ctx.panelState` still flips and `savePanelState` still persists, so the next reload restores a half-hidden panel.
- `_restoreMinimizedPanel` on boot rebuilds the minimized DOM but never re-persists, so a boot-time failure leaves `panelState='minimized'` in storage with nothing to recover it.

**Fix**:
1. Wrap the hide-loop, show-loop, and geometry writes in `toggleMinimize` in a single try/finally. Compute the target state up front, apply DOM changes, and only call `savePanelState` after the DOM loop completes without throwing. On throw, roll back the label + inline styles to the pre-toggle snapshot and log a diagnostic.
2. Kill the double-fire path in `panel-header.ts:117-127`: keep only the span's `onclick`, remove the title-row `pointerup` toggle (drag detection stays; the click-to-toggle behavior moves entirely to the `[-]/[+]` span). Preserves drag, removes the duplicate handler.
3. Add a single `applyMinimizedDom(ctx)` / `applyExpandedDom(ctx)` pair that both `toggleMinimize` and `_restoreMinimizedPanel` call, so boot-restore uses the exact same code path as the toggle. `_restoreMinimizedPanel` then calls `savePanelState('minimized')` at the end for idempotence.
4. Guarantee the picker/editor modal is still reachable while minimized (already true: `chip-gear-picker.ts` appends to `document.body`). Add a regression test that opens the picker, toggles minimize, and asserts the modal DOM node is still attached and interactive.

## Bug 2: Next button throws E001/E005 or pastes stale text

**Where**:
- Numbered Next chip: `ui/next-inline-ui.ts:904-919` → `stageNextPrompt` → `ui/task-next-ui.ts:120-276` → `getPromptsConfig()` in `ui/prompt-loader.ts:394-410` (in-memory legacy cache).
- Gear-menu Edit/Set-active/Delete: `ui/chip-gear-menu.ts:338-361` → `pickPromptFromRole` in `ui/chip-gear-picker.ts` (sql-bridge, retry-once, `PROMPT_LOAD_E001`).
- Editor save: `ui/prompt-editor.ts:240,326,345` (`PROMPT_EDIT_E005`).

**Root cause**: the write path (`chip-gear-menu` → editor save) does not call `invalidatePromptCache()` / `clearLoadedPrompts()`, so the numbered Next chip's read from `promptLoaderState.loadedJsonPrompts` is stale after any edit. When the cache is empty or torn, the chip either pastes the wrong body or falls into `pickPromptFromRole` and surfaces `PROMPT_LOAD_E001`; the editor save itself surfaces `PROMPT_EDIT_E005` when the same stale state is written back.

**Fix**:
1. In `ui/prompt-editor.ts`, after a successful save (both create and update branches), call `invalidatePromptCache()` + `clearLoadedPrompts()` before closing the editor. Same in `chip-gear-menu.ts` delete and set-active handlers.
2. In `ui/task-next-ui.ts` `selectLegacyTaskNextPrompt`, route the fallback through `listPromptsByRole('next')` from `db/prompt-db.ts` (which already uses the sql-bridge with retry-once) instead of `deps.getPromptsConfig().entries`. Keep the queue-first path unchanged. This means the Next chip and the gear-menu picker share one source of truth.
3. Wrap the new `listPromptsByRole` call in `next-inline-ui.ts` in the same `isSqlBridgeContractError` → `resetSqlBridgeCache` → retry-once pattern as `chip-gear-picker.ts:44-51`. Extract that pattern into `db/sql-bridge.ts` as `runWithBridgeRetry(fn)` and use it from both call sites so the two paths cannot drift again.
4. On final failure in the Next-chip path, emit `PROMPT_LOAD_E001` via `showDiagnosticToast` (same shape as the picker) instead of the current silent `showPasteToast('❌ "Next Tasks" prompt not found', true)`. The user then gets one consistent error surface.
5. Editor save (`prompt-editor.ts:326,345`): when the save call itself hits a bridge contract error, call `resetSqlBridgeCache('write')` + retry once before emitting `PROMPT_EDIT_E005`.

## Tests

New under `standalone-scripts/macro-controller/src/__tests__/` and `src/ui/__tests__/`:
- `panel-layout-toggle-desync.test.ts`: minimize, throw from a stubbed body element mid-loop, assert `panelState` did not flip and `savePanelState` was not called.
- `panel-header-single-toggle.test.ts`: dispatch a single click on `[-]`, assert `toggleMinimize` called once (not twice).
- `panel-restore-picker-reachable.test.ts`: open picker modal, toggle minimize, assert modal still in `document.body`.
- `next-chip-uses-sql-bridge.test.ts`: seed the DB with a "next" prompt, clear the legacy cache, click the numbered chip, assert `listPromptsByRole` was called and the correct body was pasted.
- `next-chip-retry-once-on-contract-error.test.ts`: force the first `runSql` to throw a contract error, assert `resetSqlBridgeCache` fires, second call succeeds, no `PROMPT_LOAD_E001` toast.
- `prompt-editor-invalidates-cache.test.ts`: save via editor, assert `invalidatePromptCache` + `clearLoadedPrompts` were called and `promptLoaderState.loadedJsonPrompts` is null.
- `runWithBridgeRetry.test.ts`: unit test for the extracted helper.

## Files touched

Edit:
- `src/ui/panel-layout.ts` (try/finally, shared `applyMinimizedDom`/`applyExpandedDom`)
- `src/ui/panel-header.ts` (remove title-row pointerup toggle path)
- `src/ui/panel-builder.ts` (`_restoreMinimizedPanel` uses shared apply + persists)
- `src/ui/task-next-ui.ts` (`selectLegacyTaskNextPrompt` reads via sql-bridge)
- `src/ui/next-inline-ui.ts` (retry-once + diagnostic toast on failure)
- `src/ui/chip-gear-menu.ts` (invalidate cache after write actions)
- `src/ui/prompt-editor.ts` (invalidate cache on save; retry-once + E005 fallback)
- `src/db/sql-bridge.ts` (new `runWithBridgeRetry(fn, bucket)` export)

Add:
- 7 test files listed above.

Update:
- `.lovable/memory/features/sql-bridge-adaptive-rawsql.md`: document `runWithBridgeRetry` and the single-source-of-truth rule for Next.
- `.lovable/memory/index.md`: point to the new note.

## Deliverable

- Minus/hide toggle: single click, single toggle, DOM and persisted state cannot drift.
- Next button: reads through the same sql-bridge path as the picker, respects retry-once, emits `PROMPT_LOAD_E001` consistently on real failure, and never serves stale text after an edit.
- All new tests green plus the existing `chip-gear-picker` / `prompt-io` suites still green.
