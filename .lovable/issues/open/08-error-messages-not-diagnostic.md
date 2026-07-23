# Error messages are not professional or diagnostic

Status: open
Created: 2026-07-19

## Symptom
Toasts, console errors, and thrown Error messages across the macro-controller extension are inconsistent, sometimes generic ("Something went wrong", "Failed"), and rarely capture the full variable context needed to pinpoint where they went wrong. Error IDs are not unique, and the same message string is reused across multiple call sites so grep triage fails.

## Expected
Every user-visible or logged error must:
- Carry a unique, stable error code (namespaced, e.g. `PROMPT_EDIT_E014`).
- Include ALL relevant variables (role, slug, action, input length, expected vs actual tokens, rule id, DOM id, etc.).
- Be professionally worded (no profanity, no "oops", no ambiguous "failed").
- Be greppable back to exactly one throw/log site.

## Actual
- Duplicate strings ("Failed to save prompt") emitted from 3+ files.
- Variable context missing (no role/slug/tokenCount).
- No error-code registry.

## Related files (initial)
- `standalone-scripts/macro-controller/src/error-utils.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-editor.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-injection.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-utils.ts`
- `standalone-scripts/macro-controller/src/ui/chip-gear-menu.ts`
- `standalone-scripts/macro-controller/src/ui/repair-report-modal.ts`
- `standalone-scripts/macro-controller/src/seed/*`
- `standalone-scripts/macro-controller/src/db/*`
