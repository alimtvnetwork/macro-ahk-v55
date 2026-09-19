# SS-03 design-system + inline-style scan

Parent: 16-standalone-scripts-coding-guideline-audit
Status: pending
Created: 2026-07-27

## Rules sourced from

- `spec/02-coding-guidelines/24-app-design-system-and-ui/**`
- `mem://preferences/dark-only-theme`
- `mem://features/css-injection-sentinel`

## Known hot spots

`standalone-scripts/macro-controller/src/ui/prompt-library-modal.ts` uses many literal `background:#0f1522;color:#e6edf7;border:1px solid #2b3648` cssText strings. These should be centralized tokens.

## Grep sweeps

- `rg -n "style.cssText\s*=\s*'" standalone-scripts/**/src/ui`
- `rg -n '#[0-9a-fA-F]{3,8}' standalone-scripts/**/src/ui` (hex literals in components).
- `rg -n 'rgba?\(' standalone-scripts/**/src/ui`

## Output shape

`| file:line | hexOrRgba | context (element/purpose) | proposed token | severity |`

Severity default = P2 unless the color is used in an error/warning surface (then P1, because it duplicates logger context).
