---
Slug: recorder-toolbar-and-overlays
Status: pending
Created: 2026-07-20
Parent: 30-refactor-oversized-functions-15-line-cap
---

# SS-04 Refactor recorder toolbar, drop-zone overlay, hover highlighter

Targets: `mountRecorderToolbar` (167), `mountHoverHighlighter` (134), `mountDropZoneOverlay` (71). All DOM-mount UI, same Shell+Wire pattern.

## Plan

1. For each file, extract:
   - `buildXShell()` — pure DOM construction, returns `{ root, refs }`.
   - `wireXBehavior(shell)` — attaches listeners, ResizeObserver, MutationObserver.
   - `wireXA11y(shell)` — ARIA + keyboard, mirrors `next-inline-ui.ts` approach.
   - `installXTeardown(shell)` — pagehide + explicit dispose (per `mem://standards/timer-and-observer-teardown`).
2. Public `mountX()` becomes 5-10 lines: create shell, run wires, return dispose handle.
3. Preserve existing `data-` selectors (per `mem://ui/selector-standards`).
4. Add JSDOM tests mirroring `chip-overflow.test.ts` for each mount function.

## Exit criteria

All three files lint clean under 15-line cap; recorder session smoke passes.
