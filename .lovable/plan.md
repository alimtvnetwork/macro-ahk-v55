## Verification of prior work (status)

- **PROMPT_EDIT_E005 / PROMPT_LOAD_E001 (default repair + load)**: Fixed. `sql-bridge.ts` probes/caches methods per bucket, background `project-api-handler.ts` accepts `QUERY/SELECT/READ` and `SCHEMA/EXEC/RUN/WRITE/MUTATE`, `runWithBridgeRetry` invalidates on contract errors. Covered by `project-api-rawsql.test.ts` and `prompt-load-plan-post-seed-list.e2e.test.ts`. Status: green.
- **Export only user-added prompts**: Done. `filterUserAddedEntries` gates JSON, ZIP, SQLite paths; `validatePromptEntryDetailed` forces `isDefault:false`; DB bridge returns `default-protected` on collisions. Tests: `prompt-io-export-user-only`, `prompt-io-import-protect-defaults`, `prompt-io-export-round-trip-user-only`. Status: green.
- **Next chip replace + Plan/Next prompt updates**: Fixed for the DB path. `next-inline-ui.resolveNextTextDbFirst`, `task-next-ui.selectLegacyTaskNextPrompt`, and `chip-gear-picker.pickPromptFromRole` all go through `runWithBridgeRetry`. Editor save dispatches `marco:prompts-changed` so inline chips + gear picker refresh without reload. `{{n}}` substitution has the belt-and-suspenders pass in `token-substitute.ts`. Status: green in unit + focused e2e; still unverified in the live extension.
- **Known remaining redness**: 6 pre-existing test failures in `prompt-io*` / `prompt-library-modal*` transitively loading `task-next-ui` → `sql-bridge` with a `normalizePromptEntries` mock gap; and 2 pre-existing typecheck errors (`database-json-migrate.ts`, `prompt-dropdown-io.ts:62`). Not introduced this cycle. Not in scope of the new requests below unless we opt in.

## Scope for this turn

Three new UX hardening items on top of the now-stable DB bridge:

### 1. Loading + disabled states on Next chip and editor during DB fallback

- Add a shared `useAsyncGuard` helper in `standalone-scripts/macro-controller/src/ui/async-guard.ts`: wraps an async action, sets `aria-busy="true"` + `disabled` on the trigger element, ignores re-entrant clicks, restores state in `finally`. Also cancels in-flight promise via `AbortController` on teardown.
- `next-inline-ui.ts`: wrap the click handlers on numbered Next chips and the `[-]` chip through the guard. While `runWithBridgeRetry(getDefaultPromptForRole('next'))` is pending, chip shows a small spinner glyph (reuse existing `.marco-chip-spinner` if present, otherwise add a 12px CSS spinner in `less/status.less`).
- `task-next-ui.ts`: same guard around `selectLegacyTaskNextPrompt` + submit-button resolution.
- `prompt-editor.ts` (Edit Default / Edit Specific / Next-button Edit): guard the Save button; disable input while the bridge retry loop is running; surface a subtle "Recovering DB bridge…" hint if the first attempt hit `isSqlBridgeContractError`.
- Rapid double-clicks are absorbed by the guard, so `PROMPT_LOAD_E001` / `PROMPT_EDIT_E005` cannot be re-fired mid-recovery.

### 2. Drag-and-drop import with preview + validation

- New `standalone-scripts/macro-controller/src/ui/prompt-import-dialog.ts`. Rendered from the consolidated `📤/📥 Prompts I/O` menu's "Import…" item.
- Dialog contains: drop zone (accepts `.json`, `.zip`, `.sqlite`), file picker fallback, "Paste JSON" tab.
- On drop, run `validatePromptEntryDetailed` per entry (already forces `isDefault:false`). Build a preview table: name, category, size (chars), status chip (`new` / `overwrite user` / `blocked: default` / `invalid: <reason>`).
- Show counts: `X importable · Y will overwrite · Z blocked defaults · W invalid`. Confirm button disabled until at least one importable entry exists. Cancel closes without side effects.
- Reuse `prompt-io-db-bridge.commitOneEntry`; aggregate result into a toast + updated `PromptImportResults`. Emit `marco:prompts-changed` on success.
- Tests: `src/ui/__tests__/prompt-import-dialog-preview.test.ts` (valid/invalid/mixed bundle → correct counts + confirm-enabled state); `prompt-import-dialog-drop.test.ts` (drop event → preview populated).

### 3. Delete confirmation in gear menu

- `chip-gear-menu.ts deleteCustom` and the "Delete active prompt" affordance: intercept with a small confirm dialog (reuse `.marco-dialog` from `less/dialogs.less`).
- Dialog copy: "Delete prompt '<name>'? This cannot be undone." Buttons: Cancel (default focus), Delete (destructive).
- Wire keyboard: Esc = cancel, Enter = confirm only when Delete is focused (never auto-confirmed).
- After delete, dispatch `marco:prompts-changed` (already done) so the minus button hides itself when the role goes empty.
- Test: `chip-gear-menu-delete-confirm.test.ts` (cancel path leaves DB untouched; confirm path calls `deletePromptById` exactly once).

## Verification

- Focused suites: `sql-bridge`, `prompt-db`, `next-inline`, `task-next`, `chip-gear-*`, `prompt-editor`, `prompt-import-dialog`, `prompt-io*`. Typecheck touched files with `tsgo`.
- Manual in the extension: rapid-click Next 1/2/3 during a bridge retry (guard swallows extra clicks, no error toast); drag a valid + invalid mixed bundle into the import dialog (preview shows both, confirm imports valid only); delete a custom prompt (dialog appears, cancel is no-op, confirm removes it and hides `[-]` when role becomes empty).

## Technical details

- `useAsyncGuard(el, fn)`: sets `data-busy`, `aria-busy`, `disabled`; returns a wrapped handler safe to bind to `click`. Idempotent on re-entry.
- Import dialog validation reuses `schemas/prompts-bundle.schema.json` via existing `validatePromptEntryDetailed`; no schema changes.
- Confirm dialog is a thin wrapper `ui/confirm-dialog.ts` returning `Promise<boolean>`; reusable for future destructive actions.
- No changes to the rawSql background contract, no schema migrations, no changes to the export scope rules.

## New pending tasks discovered (not in this plan, logged for backlog)

- Live verification of workspace-move v2 (`ws-move.ts` still marked PENDING-VERIFY).
- Pre-existing 6 test failures + 2 typecheck errors in import/export helpers.
- Backlog plans 13 (chat submit tracker), 22 (test coverage), 23 (light mode), 24/25/31 (eslint), 29 (version.json) still untouched.

## Out of scope

- rawSql background contract changes.
- Export-scope changes (already user-only).
- Pre-existing unrelated test/typecheck failures.
- Workspace-move v2 live verification (tracked separately).
