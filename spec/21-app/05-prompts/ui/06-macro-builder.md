# Macros Tab — Macro Builder
**Created:** 2026-06-02
The Macro Builder is the dialog that creates or edits a macro. It is the only authoring surface — there is no raw JSON editor (use Import/Export for that).
## Opening modes
| Mode    | Trigger                                     | Initial state                                            |
|---------|---------------------------------------------|----------------------------------------------------------|
| Create  | `[+ New Macro]` button on Macros tab        | Blank form; `Slug` empty, `Steps[]` length 1 (a `prompt` placeholder). |
| Edit    | Row overflow `Edit`                         | Form prefilled from the selected macro (user override copy if built-in). |
| Clone   | Row overflow `Duplicate` then `Edit`        | Form prefilled; `Slug` suffixed `-copy[-N]`.             |
Built-ins are never mutated in place. Editing a built-in transparently materialises a `MacrosUserOverride` row on first save (mirrors the prompts override pattern from `ui/04-favorites.md`).
## Form layout
```
┌─ Macro Builder ─────────────────────────────────────────────────────┐
│ Slug*        [______________________] (kebab-case, immutable on edit)│
│ Title*       [______________________]                                │
│ Description* [______________________________________]                │
│ Category     [▼ general            ]   Version* [1.0.0]              │
│ TargetScore  [▢ 90  ]  MaxLoops [▢ 3 ]  ☐ IsFavorite  ☐ Experimental │
├──────────────────────────────────────────────────────────────────────┤
│ Variables (macro-scoped)                              [+ Add]        │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Name [TargetFolder] Type [path▼] Required ☑ Default [______] ⋮ ✕│ │
│ └──────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ Steps                                                  [+ Add Step]  │
│ ┌─ 1. ⠿ [audit ▼] ────────────────────────────────────────── ▲▼ ✕ ┐ │
│ │   Slug [audit-spec▼]   WriteTo [spec/audit/{{RunId}}/01-…]      │ │
│ │   Variables: TargetFolder=[spec/21-app]  Depth=[4]              │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ ┌─ 2. ⠿ [prompt ▼] ─ Slug [gap-analysis▼] ─────────────── ▲▼ ✕ ┐  │
│ ┌─ 3. ⠿ [next-loop ▼] ─ Count [10] Condition [______] ── ▲▼ ✕ ┐  │
│ ┌─ 4. ⠿ [loop-if ▼] ─ GotoStep [0] ScoreLessThan [90] ── ▲▼ ✕ ┐  │
├──────────────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Save & Close]  [Save]        │
└──────────────────────────────────────────────────────────────────────┘
```
`⠿` = drag handle. `▲▼` = move up/down. `✕` = delete step (with confirm if it's the only step of its kind referenced by a `loop-if`).
## Step card — per-Kind fields
The Kind dropdown drives the fields rendered. Only one set is shown at a time (the schema is a discriminated `oneOf` — `schemas/macro.schema.json`).
| Kind             | Fields rendered                                                                                                  |
|------------------|------------------------------------------------------------------------------------------------------------------|
| `prompt`         | `Slug` (combobox over prompts + macro-prompts) · `Variables` (key/value rows, autopopulated from prompt's `Variables[]`) |
| `next-loop`      | `Count` (1–50) · `Condition` (Mustache-lite name ref, optional)                                                  |
| `audit`          | `Slug` (combobox) · `WriteTo` (path with `{{ RunId }}` allowed) · `Variables`                                    |
| `fix-from-audit` | `Slug` (default `fix-from-audit`, editable) · `Variables`                                                        |
| `final-audit`    | `Slug` (default `final-score`) · `WriteTo` (default `spec/audit/{{ RunId }}/99-final-report.md`) · `Variables`   |
| `loop-if`        | `GotoStep` (integer combobox of valid earlier indices) · `ScoreLessThan` (0–100)                                 |
| `set-var`        | `Name` (PascalCase) · `Value` (string/integer/number/boolean, type inferred + togglable)                         |
| `notify`         | `Message` (≤200, supports `{{ Placeholder }}`) · `Level` (info / warn / error)                                   |
## Live validation
Every keystroke runs the Ajv validator against `schemas/macro.schema.json` over the in-memory draft. Errors annotate the offending field with a red underline and a tooltip carrying the standard failure-log fields (`Reason`, `ReasonDetail`, `VariableContext[]`). The `[Save]` and `[Save & Close]` buttons disable while any error is present.
Cross-step checks (run on every change, sequential — no debounce beyond the 80ms keystroke gate):
- `loop-if.GotoStep` must be a strictly earlier index (forward jumps → `InvalidLoopTarget`).
- Every `Step.Slug` must resolve via `macro-prompts/04-resolution-order.md`. Unknown → `UnknownPromptSlug`.
- Every `{{ Placeholder }}` in `Variables` values must be declared on the referenced prompt OR be a built-in (`variables/05-built-in-context.md`). Otherwise `UndeclaredPlaceholder`.
- Slug uniqueness check against the in-memory macros set (excluding the current row when editing).
No retries; fail-fast on the first violation per field (`mem://constraints/no-retry-policy`).
## Reorder & delete
- Drag with `⠿` handle (pointer) or `Alt+ArrowUp/ArrowDown` while focus is on the step card (keyboard).
- After every reorder, `loop-if.GotoStep` values are re-validated; an invalid jump auto-clears the field and surfaces a yellow warning pill (`Reason="LoopTargetInvalidatedByReorder"`).
- Deleting a step that is the `GotoStep` target of any `loop-if` raises a confirm dialog; on confirm, the dependent `loop-if` rows are flagged invalid until the user fixes them.
## Save
Sequential pipeline (fail-fast):
1. Final Ajv validation pass.
2. Cross-reference resolution (same checks as live validation, re-run server-side in the SQLite bridge).
3. Upsert into `MacrosUserOverride` (or `Macros` if the row is brand-new user-authored).
4. Broadcast `MACROS_CHANGED` on the message bus (`mem://architecture/message-relay-system`).
5. Close dialog on `[Save & Close]`; remain open on `[Save]`.
Failures surface inline with the standard failure-log shape; the dialog never silently drops a save.
## Cancel & dirty-tracking
`[Cancel]` or `Escape` while dirty prompts `"Discard unsaved changes?"`. Clean state closes immediately.
## Test coverage (`mem://preferences/test-with-features`)
- Component test: opening in Create / Edit / Clone modes hydrates the form correctly.
- Per-Kind switch test: changing `Kind` swaps the visible fields and clears Kind-specific state.
- Live validation: typing an unknown slug shows `UnknownPromptSlug`; fixing it clears the error.
- Loop-if validity: forward jump rejected; reorder that invalidates a `GotoStep` surfaces the warning.
- Save round-trip: built-in edit materialises a `MacrosUserOverride`; cancel discards.
