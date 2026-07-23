# Macros Tab — Rows & Actions
**Created:** 2026-06-02
The Macros tab is the second tab inside the Prompts panel (`ui/01-panel-layout.md`). It lists macros, exposes per-row actions, and hosts the sticky run banner (full spec in `ui/07-run-banner.md`).
## Header row
```
🔍  Search macros…                  [+ New Macro]   [Import JSON]
```
- Search uses the same deterministic substring contract as prompts (`ui/02-filter-and-search.md`); indexed fields: `Slug`, `Title`, `Category`, `Tags`.
- `[+ New Macro]` opens the Macro Builder (`ui/06-macro-builder.md`) with a blank template.
- `[Import JSON]` opens the file picker (`json/03-import.md` — Block 6).
## Row anatomy
```
▶ <Slug>                  <BadgePill>   <CategoryChip>       [Run] [⋯]
   <Title — single line, ellipsis>
   <Description — two-line clamp, muted>
   v1.2.0 · <StepCount> steps · target <TargetScore> · max <MaxLoops>
```
Columns / pills:
| Element       | Source                                    | Notes                                                                        |
|---------------|-------------------------------------------|------------------------------------------------------------------------------|
| `▶` glyph     | static                                    | Affordance hint; not interactive.                                            |
| `<Slug>`      | `Macros.Slug`                             | Monospace; clickable to expand inline detail strip (steps preview).          |
| `<BadgePill>` | derived                                   | One of: `built-in` (muted), `user` (accent), `experimental` (amber).         |
| `<CategoryChip>` | `Macros.Category`                       | Reuses chip token from `ui/03-categories.md`.                                |
| `[Run]`       | action                                    | Primary; disabled while another macro is running in this tab.                |
| `[⋯]`         | overflow menu                             | See "Row overflow menu" below.                                               |
### Row overflow menu `[⋯]`
| Item            | Enabled when                              | Behaviour                                                                 |
|-----------------|-------------------------------------------|---------------------------------------------------------------------------|
| `Edit`          | always                                    | Opens Macro Builder pre-loaded with this macro.                           |
| `Duplicate`     | always                                    | Clones into `MacrosUserOverride` with slug `<slug>-copy[-N]`.             |
| `Export JSON`   | always                                    | Triggers Block 6 export flow for this single macro.                       |
| `Pin to favorites` / `Unpin` | always                       | Toggles `IsFavorite` (see `ui/04-favorites.md`).                          |
| `Delete`        | `IsBuiltIn === false`                     | Confirmation dialog; deletes the user/override row only. Built-ins protected. |
| `View run history` | run history exists                     | Opens `spec/audit/` listing for `RunId`s of this slug (read-only).        |
Built-in protection mirrors the categories pattern (`ui/03-categories.md`) — deletes raise `Reason="MacroBuiltIn"` if attempted programmatically.
## Sort order
Default:
```
ORDER BY IsFavorite DESC, IsBuiltIn DESC, NumericPrefix ASC, Slug ASC
```
Favorites pinned to the top, then built-ins (the curated starters), then user macros in slug order.
## Running state — row affordance
When a macro is running, its `[Run]` button is replaced with `[⏸ Pause]` and `[⏹ Stop]` inline mini-buttons. Other rows' `[Run]` buttons go to `disabled` with tooltip `"Another macro is running"`. State is driven by `MACRO_RUN_STATE_CHANGED` events (Block 7); no polling. Listener teardown paired per `mem://standards/timer-and-observer-teardown`.
## Sticky run banner
When `state.activeRun !== null`, a sticky banner pins to the bottom of the panel (full anatomy in `ui/07-run-banner.md`). It is shared between Prompts and Macros tabs — switching tabs does not hide it.
## Empty states
| Condition                                | Message                                                              |
|------------------------------------------|----------------------------------------------------------------------|
| No matching search results               | `"No macros match \"<query>\""` + `[Clear]`                          |
| No macros at all (built-ins not seeded)  | `"No macros loaded."` + `[Retry seed]` + `[Import JSON]`             |
| User has only built-ins                  | Footer hint: `"Use [+ New Macro] to author your own."`               |
## Validation surfaces
- Clicking `[Run]` on a macro with unresolved required variables opens the inline Variable Input Dialog (`ui/09-variable-input-dialog.md`) BEFORE the engine starts.
- Schema-invalid macros (e.g. corrupted user override) render in the list with a red border, `[Run]` disabled, tooltip showing the `Reason` from `MacroSchemaViolation` and a `[View error]` button that opens the failure-log JSON.
## Tokens (HSL — `mem://preferences/dark-only-theme`)
```css
--macro-row-bg:        var(--panel-bg);
--macro-row-bg-hover:  var(--panel-row-hover);
--macro-row-border:    var(--panel-border);
--macro-row-error:     hsl(0 70% 45%);
--macro-badge-builtin: hsl(220 8% 55%);
--macro-badge-user:    hsl(38 92% 56%);
--macro-badge-exp:     hsl(280 70% 60%);
```
## Test coverage (`mem://preferences/test-with-features`)
- Render: 4-row fixture (1 favorite, 2 built-in, 1 user) sorts per the documented ORDER BY.
- Overflow menu: `Delete` is hidden on built-ins; `Duplicate` produces `<slug>-copy`, `<slug>-copy-2`, … on collision.
- Running state: emitting `MACRO_RUN_STATE_CHANGED` swaps `[Run]` for `[⏸][⏹]` on the active row and disables all other `[Run]` buttons.
- Schema-invalid row: malformed override renders the red-border state with the `Reason` surfaced.
