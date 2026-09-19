# Variable Input Dialog
**Created:** 2026-06-02
When a macro step references a prompt with `Required` variables that have no value at runtime (no step-level value, no macro-level value, no run-context value, no `Default`), the engine pauses and the panel renders this inline dialog to collect them. Submitting resumes the run; cancelling stops it.
## Trigger
Engine raises `MACRO_RUN_AWAITING_VARS` with payload:
```json
{
  "RunId": "spec-tighten-cycle-20260602-101500",
  "StepIndex": 3,
  "Kind": "audit",
  "PromptSlug": "audit-spec",
  "Missing": [
    { "Name": "TargetFolder", "Type": "path",    "Required": true,  "Description": "Subtree to audit." },
    { "Name": "Reviewer",     "Type": "enum",    "Required": true,  "EnumValues": ["alice", "bob"], "Description": "Who signs off." }
  ]
}
```
The run banner Status flips to `WaitingVars`; the dialog mounts inline above the banner.
## Layout
```
┌─ Variables needed for step 4 (audit · audit-spec) ──────────────┐
│ Some variables don't have a value yet. Fill them in to continue. │
│                                                                   │
│ TargetFolder *                                                    │
│   [ spec/21-app                                          ]        │
│   Subtree to audit.                                               │
│                                                                   │
│ Reviewer *                                                        │
│   ( ) alice    ( ) bob                                            │
│   Who signs off.                                                  │
│                                                                   │
│                                  [ Cancel ]   [ Submit & Resume ] │
└───────────────────────────────────────────────────────────────────┘
```
## Per-`Type` widget
| Variable `Type` | Widget                                                     | Validation                                                               |
|-----------------|------------------------------------------------------------|--------------------------------------------------------------------------|
| `string`        | single-line text input                                     | Non-empty when `Required`; trim.                                         |
| `integer`       | numeric input (`inputmode="numeric"`, integer pattern)     | Parses to integer; rejects float/NaN.                                    |
| `number`        | numeric input (`inputmode="decimal"`)                      | Parses to finite number.                                                 |
| `boolean`       | toggle (default OFF)                                       | Always valid; no `Required` enforcement (toggle implies a value).        |
| `enum`          | radio group from `EnumValues[]`                            | One option required.                                                     |
| `path`          | single-line text input + monospace font, leading `/` hint  | Non-empty; rejects characters `\0`, `\n`, `\r`; max 256 chars.            |
Widget choice is driven purely by `Type` — no per-prompt customisation. Type coercion follows `spec/21-app/05-prompts/variables/04-types.md`.
## Sensitive variables
When `Sensitive === true` on a missing var:
- Widget is `<input type="password">`.
- Value is masked as `***` in any failure-log written for this step (and never logged in plain — `mem://standards/verbose-logging-and-failure-diagnostics`, `variables/07-sensitive-masking.md`).
- The value is NOT persisted to `chrome.storage.local` after submission; it lives only in the in-memory run context for the remainder of the run.
## Validation
Live validation per field on `blur` AND on `input` (debounced 80ms):
- Required + empty → `Reason="MissingVariable"`.
- Type coercion failure → `Reason="VariableTypeMismatch"`.
- Path validation failure → `Reason="VariablePathInvalid"`.
All inline errors render under the field with the standard failure-log shape compacted to `Reason: <ReasonDetail>`. `[Submit & Resume]` is disabled while any field has an error or is empty (when `Required`).
## Actions
| Button             | Behaviour                                                                                              |
|--------------------|--------------------------------------------------------------------------------------------------------|
| `[Submit & Resume]`| Engine merges the collected values into the step-level `Variables` map (resolution tier 1) and resumes. |
| `[Cancel]`         | Confirm dialog `"Cancel this run?"`. On confirm → Status `Stopped`, engine teardown.                   |
| `Escape`           | Same as `[Cancel]`.                                                                                     |
| `Enter`            | Triggers `[Submit & Resume]` when the form is valid; otherwise no-op.                                  |
`[Cancel]` and `Escape` never silently drop the run — they always require explicit confirmation to avoid data loss on accidental keypress.
## ARIA
- Dialog is `role="dialog"` with `aria-modal="true"` (blocks panel interaction while open — the run cannot continue without input).
- `aria-labelledby` points at the title (`"Variables needed for step <N> (<Kind> · <PromptSlug>)"`).
- First invalid field auto-focuses on mount; tab order follows the form sequence.
- Errors use `role="alert"` on first render, downgraded to inline text afterwards.
## Persistence
Submitted values are written to the in-memory run context **only** (not to `chrome.storage.local`) — see `mem://constraints/no-storage-pascalcase-migration` for the broader storage-identity rule. The engine's `MacroRunState.<RunId>` persisted record carries the merged values so Pause/Resume across SW restarts continues to work; Sensitive vars are stripped from that persisted record and re-prompted on resume.
## Tokens (HSL — `mem://preferences/dark-only-theme`)
```css
--var-dialog-bg:       var(--panel-bg);
--var-dialog-border:   hsl(38 92% 56%);   /* warn accent — needs input */
--var-dialog-fg:       var(--panel-fg);
--var-dialog-muted:    var(--panel-muted);
--var-dialog-error:    hsl(0 70% 50%);
--var-dialog-shadow:   0 -8px 24px hsl(0 0% 0% / 0.45);
```
## Test coverage (`mem://preferences/test-with-features`)
- Triggering: a step with 2 missing required vars opens the dialog with those 2 fields and no others.
- Widget mapping: each `Type` renders the documented widget.
- Sensitive: `type="password"` widget; submitted value is masked in the run's `MacroRunState` persisted blob; re-prompted on resume after SW restart.
- Validation: required+empty disables submit; bad integer surfaces `VariableTypeMismatch`; enum requires a selection.
- Cancel: confirmation gate prevents accidental data loss; on confirm, Status flips to `Stopped`.
- Keyboard: `Enter` submits when valid; `Escape` triggers `[Cancel]`.
