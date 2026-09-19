---
Slug: function-size-cap-15-lines
Status: active
Created: 2026-07-20
Scope: all TypeScript/JavaScript production and test code
---

# Command: 15-line maximum per function

## Verbatim (user, 2026-07-20)

> "make this ... following the guideline which we have, like 15 lines is max. So refactor the codes properly so that it does not break."

## Rule

Every function, method, arrow function, and callback body MUST be <= 15 lines (excluding the signature line and closing brace). Exceptions require explicit user approval documented in `.lovable/memory/standards/`.

## Applies to

- All `.ts`, `.tsx`, `.mjs`, `.js` files in the repo (production, tests, scripts).
- Both new code and any file being edited (opportunistic refactor when touched).

## Enforcement

- ESLint `max-lines-per-function`: `{ max: 15, skipBlankLines: true, skipComments: true, IIFEs: true }` at the repo root config, applied to test files too.
- Cognitive complexity remains capped at 15 (`sonarjs/cognitive-complexity`).
- Refactor pattern: extract named helpers, split "build shell" from "wire behavior", prefer pure functions with typed params.

## When it applies

Immediately, from 2026-07-20 forward, for every subsequent code change.
