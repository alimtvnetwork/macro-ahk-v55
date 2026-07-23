# Light mode UI broken across strip frame, prompt library, and editor

Status: open
Created: 2026-07-18

## Symptom

User reports the UI looks "broken" when the theme is switched to light. Dark theme is the default (mem://preferences/dark-only-theme) but the project ships a light theme surface (Lovable web preview + host page). Components use hardcoded dark colors or `bg-black` / low-contrast overlays, leading to unreadable text, invisible borders, and washed-out chips in light mode.

Screenshot pending from user.

## Expected

Every surface (strip frame, prompts dropdown, prompt library modal, prompt editor, import/export section, More popovers) uses semantic tokens from `index.css` and remains readable and visually consistent in both dark and light. No `text-white`, `bg-black`, or `bg-[#…]` literals in components.

## Actual

Hardcoded colors / low-contrast overlays leak through in light theme.

## Related files

- `standalone-scripts/macro-controller/src/ui/*.css` and inline styles
- `index.css` (root tokens)
- Any component still using literal `text-white` / `bg-black` / `bg-[#…]`

## Definition of done

- Audit script (rg on the standalone-scripts + src trees) reports zero literal color utilities in components.
- Screenshot diff: dark + light both readable for strip frame, dropdown, library, editor.
- Regression test toggles theme and asserts contrast on key text nodes.
