# Command: Professional, diagnostic error messages with unique codes

Created: 2026-07-19
Scope: All error paths in standalone-scripts (extension) and any user-facing surface (toasts, modals, console).
When it applies: Every new/changed throw, reject, `Logger.error`, toast-error, or thrown diagnostic.

## The command (verbatim intent)
"Make sure the error messages are professional and easy to figure out where it went wrong. It should have unique [codes] and all the variables should be captured."

## Rules
1. Every error MUST carry a unique code from a central registry (`error-codes.ts`), formatted `<AREA>_<ACTION>_E<NNN>` (e.g. `PROMPT_SAVE_E001`).
2. Every error MUST capture a `context` object with all relevant variables (role, slug, action, ruleId, expected, actual, inputHash, elementId, timestamp).
3. Message text MUST be professional: no profanity, no "oops"/"WTF", no bare "Failed". Must state (a) what was attempted, (b) why it failed, (c) next fix step.
4. No duplicate message strings across files. Grep for a code must yield exactly one throw site.
5. Toasts render the human sentence + the code in monospace; the full context object goes to `Logger.error(code, context)` and to the diagnostics ZIP.
6. Registry entries include: code, area, severity, humanTemplate, requiredContextKeys[].
