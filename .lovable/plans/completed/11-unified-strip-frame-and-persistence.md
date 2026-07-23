# Unified Plan/Next/Repeat frame with persistence

Slug: unified-strip-frame-and-persistence
Steps: 5
Status: completed
Created: 2026-07-16

## Context
User wants Plan, Next, and Repeat inline strips merged into one framed container above the Lovable composer, with a single minimize/maximize toggle. Currently they render as three separate frames (see screenshot in issue). Additionally, closing the macro-controller ("TS Macro") panel currently removes the strips; they must persist independently until the user explicitly removes them.

Related:
- Issue: `.lovable/issues/02-strip-frame-and-persistence.md`
- Prior plan (three-strip decoupled): `.lovable/plans/completed/09-three-strip-decoupled-plan-next-repeat.md`
- Files: `standalone-scripts/macro-controller/src/ui/next-inline-ui.ts` and sibling `*-inline-ui.ts` mounts, macro-controller panel close handler.

## Steps

1. Audit current strip mounts: locate the mount host / DOM parent for Plan, Next, and Repeat inline strips in `standalone-scripts/macro-controller/src/ui/`, and identify the panel-close teardown path that removes them. Record findings in `./subtasks/11-unified-strip-frame-and-persistence/01-audit.md`.
2. Introduce a single container element (`marco-inline-strips-frame`) that owns Plan + Next + Repeat rows as children, with shared header (label + minimize/maximize chevron + explicit close/remove button). Move each existing row into this frame without changing row internals.
3. Add minimize/maximize state on the frame (persisted in local settings / IndexedDB kv, key `inline_strips_collapsed`) that hides/shows the three rows together. Chevron toggles it; state restores across reloads.
4. Decouple strip lifecycle from the macro-controller panel: mount the frame on a stable host (composer-adjacent), and remove the teardown call from the panel close handler. Add an explicit "remove strip" action (the frame's close button) that is the ONLY path that unmounts the frame. Persist a `inline_strips_removed` flag so removal survives reloads until the user re-enables from the panel.
5. Verify: run `pnpm build` for macro-controller, load extension, screenshot the unified frame (single border, one chevron), toggle minimize/maximize, close the TS Macro panel and confirm strips remain functional, click explicit remove and confirm they unmount + stay removed after reload, then re-enable from panel menu.

## Verification
- Build passes: `run.ps1` (standalone-build) with no errors.
- Visual: single framed container with header row above the composer; three rows inside share one border.
- Behavior: minimize collapses all three; TS Macro close leaves strips alive; explicit remove unmounts them; reload preserves collapsed + removed state.
- Regression: Plan number buttons (5,10,12,15,20,25,30,50) and Next buttons (1,2,3,4,5,8,10,15) still paste-only, no submit.

## Appended from prior pending tasks
- `10-unified-billing-all-workspaces.md` — unrelated billing workstream, remains pending.
