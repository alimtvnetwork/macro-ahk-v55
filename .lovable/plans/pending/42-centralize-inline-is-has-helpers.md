# Task 42: Move Inline `is*`/`has*` Helpers to Dedicated Utils/Types Files

## Problem
Many business logic files contain private `is*` and `has*` helper functions that:
1. Are not specific to that file's domain
2. Could be reused across multiple modules
3. Pollute the file's logical scope

These should live in dedicated `utils`, `types`, or domain-specific helper files so they are discoverable and reusable.

> **Rule**: Any `is*`/`has*`/`check*` function that validates a domain concept (theme, plan type, auth status, etc.) must live in the types or utils file for that domain — NOT inline in a handler or UI file.

---

## Critical Violations

### 1. Theme validation — `config-validator.ts` (L15)
`isInvalidThemePreset(preset)` validates a theme concept. It must be moved to:
- **Target**: `standalone-scripts/macro-controller/src/types/theme-types.ts` (create if missing)
- Export it so it can be imported by `config-validator.ts`

### 2. Auth failure detection — duplicated in 5 files
`isAuthFailure(status: number)` is identically defined in:
- `credit-balance.ts:94`
- `credit-fetch.ts:103`
- `loop-cycle-fallback.ts:56`
- `workspace-detection.ts:29`
- `ws-adjacent.ts:33`
- `ws-move.ts:37`

**Fix**: Create `standalone-scripts/macro-controller/src/auth-utils.ts` (or add to existing `auth-resolve.ts`), export a single `isAuthFailure(status: number): boolean`, and replace all 6 inline definitions with a single import.

### 3. Plan type checks — `credit-totals.ts` + `ws-context-menu.ts`
- `isFreeTierWorkspace(ws)` — `credit-totals.ts:82`
- `isProZeroPlan(ws)` — `credit-totals.ts:90`
- `isProOnePlan(ws)` — `ws-context-menu.ts:102`

**Fix**: Move all three to `standalone-scripts/macro-controller/src/types/workspace-plan-utils.ts` (create if missing). Import from there.

### 4. Object/primitive guards — scattered across files
- `isPlainObject(v)` — `config-validator.ts:58` AND `ui/prompt-bundle-types.ts:96` (duplicated!)
- `isNonEmptyString(value)` — `ui/prompt-bundle-types.ts:101`
- `isTruthy(value)` — `ui/template-renderer.ts:172`
- `isFiniteNonNegative(n)` — `settings-store.ts:104`

**Fix**: Move all to `standalone-scripts/macro-controller/src/utils/type-guards.ts` (create if missing). Remove duplicates.

### 5. UI-only helpers that are okay where they are (do NOT move these)
These are UI-specific and tightly coupled to their file — leave them in place:
- `hasRightSpaceForMenu` — `prompt-dropdown.ts:118`
- `isJsonPrefix` — `prompt-io-format-detect.ts:39`
- `isMonotonicAt` — `prompt-order-indicator.ts:88`
- `isSplitterCandidate` — `task-splitter-dom.ts:15`

---

## Instructions for AI Fixer
1. Create the new files listed above.
2. Move each function with its JSDoc comment (if any).
3. Add the correct import in the source file.
4. Delete the old inline definition.
5. Verify no duplicate exports across files.
6. Run `pnpm run lint` and fix any warnings.
7. Commit: `refactor: centralize is*/has* guard helpers into dedicated utils files`
