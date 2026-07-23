# 66 — Light mode support vs dark-only memory

## Ambiguity
- Project memory `mem://preferences/dark-only-theme` states: dark-only, no light mode, no theme toggles.
- User Issue 07 (2026-07-18): "the UI looks bad when it goes to the light mode. So make sure, when we go into the light mode of the theme, the UI should look nice."

## Interpretation chosen
User's explicit, recent correction wins over prior memory. Scope is narrow: the injected Prompt Library modal (and inline editor) must remain readable when the host page / OS uses `prefers-color-scheme: light`. The extension does not add a theme toggle; it reacts to the host media query only. Dark remains the default.

## Pros
- Honors explicit user complaint with a real fix.
- No new toggle UI; zero extra state.
- Extension retains dark identity when host is dark.

## Cons
- Slight divergence from `dark-only-theme` memory. Memory to be updated after Step 2 lands.

## Recommendation
Proceed. Extract semantic tokens in Step 1; provide light-mode values via `@media (prefers-color-scheme: light)` in Step 2.
