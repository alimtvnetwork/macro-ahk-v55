# RCA: UI Glitch in Prompt Dropdown Header Buttons

## Incident Overview
**Error:** Buttons in the top header of the Prompt Dropdown (PlanTierType, ord: LS, Library, RM Admin, Prompts I/O, Reset to default order, Load) had inconsistent heights, poor text contrast, and aggressive text wrapping.
**Phase:** UI Rendering (`macro-controller`)
**Date:** 2026-08-22

## Root Cause
The `buildDropdownHeader` function creates a flex container with `gap: 6px` to hold a strip of action buttons. However, the individual pill elements (`buildHeaderPill`, `buildLoadButton`, `buildPromptOrderIndicator`) were missing explicit layout constraints like `white-space: nowrap` and a fixed `height`. 

When the dropdown container width was constrained or when standard flexbox squeezing occurred, the flex layout collapsed the buttons horizontally. Because `white-space: nowrap` was missing, the browser aggressively wrapped the button text onto multiple lines (e.g., turning "Reset to default order" into a highly elongated vertical button), creating severely inconsistent pill heights. Furthermore, the `ord: LS` badge used a dark foreground `hsl(var(--accent))` against a dark blue background `rgba(59,130,246,0.25)`, leading to illegible contrast in dark mode.

## Resolution
1. Added `white-space: nowrap`, `display: inline-flex`, `align-items: center`, and a uniform `height: 22px` to the base `style.cssText` for `buildHeaderPill` in `prompt-dropdown-io.ts`.
2. Replicated this uniform layout standard on standalone pills (`buildLoadButton` and `buildPlanTabMarker`) in `prompt-dropdown-header.ts` and the badge indicator in `prompt-order-indicator.ts`.
3. Adjusted padding vertically to rely on flex centering rather than manual offsets to ensure perfect vertical alignment across all buttons.
4. Corrected the `ord: LS` active saved-state foreground color from the low-contrast `--accent` variable to a crisp `#60A5FA` (Tailwind blue-400), ensuring legibility against its background.

## Prevention
1. **Always enforce nowrap on flex-container buttons:** UI pills and badges inside `display: flex` rows must explicitly set `white-space: nowrap` to prevent layout collapse under space constraints.
2. **Standardize inline dimensions:** Use `inline-flex` and explicit `height` on horizontal pill groups instead of relying solely on implicit content-box padding to achieve uniform height.
3. **Contrast Verification:** When designing badges for dark mode, explicitly define standard contrast pairs (e.g., light blue on dark blue) rather than combining generic variables that may yield dark-on-dark pairings.
