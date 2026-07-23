---
Slug: audit
Status: completed
Created: 2026-07-16
Parent: 11-unified-strip-frame-and-persistence
---

# SS-01 — Audit: current strip mounts & teardown

## Root cause (one sentence)
The three inline strips are mounted as SIBLINGS above the chat form (not children of the TS Macro panel), so they look scattered visually, and `destroyPanel()` in `ui-updaters.ts` explicitly calls `inlineRepeat.remove()` on the Repeat strip during "close TS Macro", which is why the strips disappear (the Repeat strip is force-removed; Plan/Next survive in DOM but the group visually breaks and Lovable SPA rerenders can drop the observer host).

## Mount points (files + lines)

| Strip  | DOM id                | Built in                                            | Mounted in                                                                    | Anchor                                             |
|--------|-----------------------|-----------------------------------------------------|-------------------------------------------------------------------------------|----------------------------------------------------|
| Plan   | `marco-split-inline`  | `next-inline-ui.ts` `buildSplitStrip()` (~L194)     | `next-inline-ui.ts` `tryMountInline()` L302-307                               | `form.parentElement.insertBefore(splitStrip, form)` |
| Next   | `marco-next-inline`   | `next-inline-ui.ts` `buildNextStrip()` (~L260)      | `next-inline-ui.ts` `tryMountInline()` L308-318                               | inserted after `SPLIT_ID`                          |
| Repeat | `marco-repeat-inline` (wrapped in `marco-repeat-inline-wrap`) | `repeat-loop-ui.ts` `buildControl()` L637 | `repeat-loop-ui.ts` `tryMountInline()` L634-643                                | `form.parentElement.insertBefore(wrap, form)`      |

Callers: `panel-builder.ts` L250-251 (`mountNextInlineStrip(taskNextDeps); mountRepeatInlineStrip();`).

Each has its own module-scope `MutationObserver` (`_observer` / `_inlineObserver`) that re-mounts on SPA rerender.

## Group collapse state
`inline-strip-group-collapse.ts` already persists a single `collapsed` bool in `localStorage['marco-inline-strip-group-prefs']` and applies it to all three via id lookup. **The toggle lives ONLY on the Plan strip** (`repeat-loop-ui.ts` L641-642). This is the seed we can extend.

## Teardown paths (why strips die on TS Macro close)
- `ui-updaters.ts` `destroyPanel()` L187-231 called from:
  - `panel-header.ts` L109 — hide button `hideBtn.onclick`.
  - `hot-reload-section.ts` L163.
  - `core/UIManager.ts` L41, `macro-looping.ts` L99 (`api.ui.destroy`).
- L201-202: explicitly `document.getElementById('marco-repeat-inline').remove()`. **Repeat strip is force-removed on every close.** Plan + Next are NOT removed, but the observer is not disconnected either.
- No wrapper frame exists — the three strips are visually independent siblings with their own margins (`4px 0 2px`, `0 0 2px`, `4px 0`).

## Implications for the fix (steps 2-5)
1. Wrap all three in a single container `marco-inline-strips-frame` (single border, one header with chevron + explicit remove ×).
2. Move the "hide Repeat on close" line out of `destroyPanel()` — teardown should NOT touch inline strips at all. The strips already survive SPA rerenders via their observers.
3. New explicit remove action (× on the unified frame) is the ONLY DOM removal path; persist `removed=true` so it stays gone after reload. Panel menu re-enables it.
4. Minimize state can reuse `inline-strip-group-collapse.ts`; just apply to the new frame's body wrapper instead of the three ids individually.

## Files that will change in later steps
- `standalone-scripts/macro-controller/src/ui/next-inline-ui.ts` — mount into frame body.
- `standalone-scripts/macro-controller/src/ui/repeat-loop-ui.ts` — mount into frame body; drop own wrapper.
- `standalone-scripts/macro-controller/src/ui/inline-strip-group-collapse.ts` — extend with `removed` flag + frame builder, or split into new `inline-strips-frame.ts`.
- `standalone-scripts/macro-controller/src/ui/ui-updaters.ts` — remove L201-202 `inlineRepeat.remove()`.
- `standalone-scripts/macro-controller/src/ui/panel-builder.ts` — replace two mount calls with one `mountInlineStripsFrame()`.

## Verified signal
- `rg` output above shows only ONE explicit strip removal in teardown (Repeat, L201-202). Plan/Next don't have removal calls — they persist unless Lovable rerenders and the observer isn't running.
- Group collapse infra already exists; wiring one wrapper only requires reusing `applyInlineStripGroupCollapse`.

Ready for step 2 (build the unified frame).
