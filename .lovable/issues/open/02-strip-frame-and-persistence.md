# Issue 02 — Plan/Next/Repeat strips scattered and lost on TS Macro close

Status: open
Created: 2026-07-16

## Symptom
- Plan, Next, and Repeat inline strips render as three separate frames stacked in the composer area (see user screenshot). User wants them unified into ONE frame with a single minimize/maximize control.
- When the user closes the "TS Macro" (macro-controller floating UI / hamburger panel), the Plan / Next / Repeat strips disappear entirely. They should persist and remain functional until the user explicitly removes them.

## Expected
- Single container frame wrapping Plan row + Next row + Repeat row.
- One minimize/maximize toggle on that unified frame collapses/expands all three at once.
- Strips survive closing the macro-controller panel; only an explicit "remove strip" action tears them down.

## Actual
- Three independent frames, each with its own borders/padding.
- Closing the TS Macro tears down the strips as if they were children of the panel.

## Related files (candidates)
- `standalone-scripts/macro-controller/src/ui/next-inline-ui.ts`
- `standalone-scripts/macro-controller/src/ui/plan-inline-ui.ts` (if separate)
- `standalone-scripts/macro-controller/src/ui/repeat-inline-ui.ts` (if separate)
- `standalone-scripts/macro-controller/src/ui/*mount*` / composer-injection host
- Macro-controller panel lifecycle (close handler tearing down strip DOM)

## Scope
UI + lifecycle only. No business logic changes to Plan / Next / Repeat behavior.
