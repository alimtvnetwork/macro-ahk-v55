# Prompt Ordering Bug & Plan

The drag-and-drop bug happens because the dropdown caches the DOM as an HTML string (`_memSnapshot`) for fast synchronous rendering. When you finish a drag, the system correctly updates your saved order in `localStorage`, but then it triggers a fast-path re-render using the *old* HTML string from before the drag! This not only visually reverts the order, but also destroys the drag-and-drop event listeners on the DOM nodes, breaking subsequent drags.

The "Release" prompt ordering issue happens because your local `localStorage` already has an older saved order where "Release" was at position 15. Although `DEFAULT_PROMPT_ORDER` correctly places "Release" at the very bottom, the migration logic that forces it to the bottom only runs once when the "Migration Revision" number is bumped.

## Proposed Plan

1. **Fix the Drag-Drop bug:** In `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`, I will modify the callback passed to `attachDragHandlers` to explicitly set `_memSnapshot = null`. This forces the dropdown to render fresh from the newly saved order instead of using the stale HTML, instantly fixing the visual revert and preserving drag listeners.
2. **Fix the Release ordering:** In `standalone-scripts/macro-controller/src/ui/prompt-drag-order.ts`, I will bump `CURRENT_MIGRATION_REV` from `4` to `5`. This forces the migration logic to run on your next load, which will rip "Release" (and other terminal items) out of their stuck positions and forcefully append them to the absolute bottom.
