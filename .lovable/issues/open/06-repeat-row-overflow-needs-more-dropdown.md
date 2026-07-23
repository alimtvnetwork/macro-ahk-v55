# Repeat row overflows — needs a "More" dropdown after 50

Status: open
Created: 2026-07-18

## Symptom

Repeat strip renders every option inline (1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 100, 125, 150, 200). After 50 the row wraps and pushes wait-mode controls down. See uploaded screenshots (file-17, file-18).

## Expected

Same pattern as Plan row: keep the common values inline (up to and including 50), collapse the rest under a `More ▾` popover button. Popover lists the overflow presets (60, 70, 75, 80, 100, 125, 150, 200) and any user-added values.

## Actual

All presets rendered inline; row is wider than the strip frame; visual crowding.

## Related files

- `standalone-scripts/macro-controller/src/ui/strip-frame.ts` (Repeat row)
- `standalone-scripts/macro-controller/src/ui/plan-more-popover.ts` (reference implementation to copy)

## Definition of done

- Repeat row shows presets ≤ 50 inline plus a `More ▾` button.
- Popover matches Plan `More ▾` visual + keyboard behavior.
- No horizontal overflow at min supported width.
- Regression test asserts overflow presets are hidden until `More` is clicked.
