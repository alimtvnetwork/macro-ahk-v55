---
Slug: refactor-recipes
Parent: 24-eslint-warnings-cleanup-30
Status: pending
Created: 2026-07-19
---

# Refactor Recipes

Four canonical patterns to apply mechanically across the 265 lint hits.

## R1. Extract helper (max-lines-per-function)

Split a >40-line function into named helpers by concern:
- Setup / arg validation → `resolveX(args)`
- Core branching → `handleY(state)`
- IO / DOM writes → `applyZ(target)`
- Teardown / listeners → `wireEvents(host)` returning a disposer.

Rule: each helper < 40 lines, single responsibility, pure where possible.

## R2. Rename identifiers (id-denylist)

Fixed mapping (apply repo-wide):
- `arr` → `items` or `bucket`
- `cb` → `callback` (function) or `checkbox` (DOM)
- `fn` → `handler` or `task`
- `el` → `node` or `host`
- `msg` → `payload` or `messageNode`
- `e` in catch → `caught`; `e` in events → `event`

Rename in tests in the same commit to keep signal green.

## R3. Extract constant (no-duplicate-string)

Any string literal repeated ≥3 times in a file → module-scoped `const`.
Cross-file duplicates → central `src/shared/*-constants.ts`. Prefix per constant-naming convention (`ID_`, `SEL_`, `ATTR_`, `CSS_`).

## R4. Flatten branches (cognitive-complexity)

- Prefer early return over nested `if`.
- Extract predicate: `if (isEligible(x))` instead of inline compound conditions.
- Table-driven dispatch: `const table: Record<Kind, Handler>` replaces long `switch`.
- Collapse `if (a) { if (b) ... }` → `if (a && b) ...` (also fixes no-collapsible-if).
