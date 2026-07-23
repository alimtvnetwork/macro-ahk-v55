# 09 — Macro Controller Panel BG Transparency (UI bleed)

**Logged:** 2026-06-23
**Source:** User screenshot attached with message "FIX the UI issues and then release".

## What I see in the screenshot

In the floating macro-controller panel, the area from the Search input downward (workspace list + Move row) appears to render *over* the IDE code editor — IDE text strings such as `lovable-blank-page-placeholder`, `Image data:`, `<Link`, `className="absolute bottom...`, etc. visibly bleed through behind the workspace rows. The title row (TS Macro / Pro counts / Stopped / Check / Play / Credits / Prompts) is solidly opaque.

## Why I did not auto-fix

The panel root (`#marco-loop-panel`) already sets `background: cPanelBg` where `cPanelBg = TP.background || '#1e1e2e'` (opaque). The `wsDropSection` adds `background: rgba(0,0,0,.3)` on top of an already-opaque parent, which should not produce bleed-through.

That means the visible bleed is most likely caused by one of:
1. The theme provider (`TP.background`) is being overridden at runtime with a translucent value (e.g. `rgba(...)` from a user theme or a stale settings migration).
2. The panel's `overflow:hidden` + fixed `PANEL_DEFAULT_HEIGHT` is being defeated by an absolutely-positioned child (workspace list `max-height:160px;overflow-y:auto;`) that escapes the panel box on this user's viewport/zoom.
3. The panel is being rendered into an unexpected container (BODY fallback path in `createUI`, `container === document.body`) and a CSS reset on `lovable.dev` collapses the panel's background.
4. A regression in `panel-builder.ts` removed/clobbered the `background:` on `ui.style.cssText` for a code path I have not identified.

Without a reliable reproduction it is not safe to:
- Hard-code an opaque colour (would override user themes), or
- Add `!important` to `cPanelBg` (constraint: design tokens stay editable).

## Options for the user to pick

| # | Option | Pros | Cons | Recommendation |
|---|--------|------|------|----------------|
| A | Force the panel root `background` to fall back to a guaranteed opaque hex when `TP.background` resolves to any `rgba(...)` or transparent value. Patch `cPanelBg` to validate and reject translucent themes. | Eliminates bleed for all themes; one-line guard. | Silently overrides user theme choices that may want translucency. | **Recommended** if the user does not need translucent panels. |
| B | Add a second opaque layer `<div>` *inside* `#marco-loop-panel` that sits behind all child sections (`position:absolute;inset:0;background:#1e1e2e;z-index:0`). Children get `position:relative`. | Preserves theme tokens; pure additive fix; covers any future child that forgets a bg. | Requires touching panel-builder.ts assembly + adding stacking context for ~6 sections. | Safe fallback if Option A is rejected. |
| C | Treat the screenshot as showing the *expected* translucent style and instead fix only the workspace-row horizontal overflow (the row content wraps under the scrollbar). | Tiny surface-area change; no theme risk. | Doesn't resolve the IDE-bleed which is the dominant visual problem. | Only if the user confirms translucency is intentional. |

## What I shipped in v3.104.4

- Version bump only (`3.104.3` → `3.104.4`) to sync repo with the pre-existing `.gitmap/release/v3.104.4.json` descriptor that the release watcher is already pointing at.
- This ambiguity log so the next turn can apply Option A / B / C without re-investigating.

## To unblock

User to reply with **A**, **B**, or **C** (or paste a clearer screenshot / DOM inspector snapshot of `#marco-loop-panel` computed `background-color`).
