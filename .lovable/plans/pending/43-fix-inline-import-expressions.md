# Task 43: Fix Inline Import Expressions — Move to Top-Level Static Imports

## Problem
Several production files use `import('./types').SomeType` as inline type annotations inside function signatures, or `await import('./module')` inside function bodies. This pattern:
1. Hides dependencies — you can't see what a file depends on without reading every line
2. Breaks tree-shaking and bundler analysis
3. Violates the coding guideline that says "never have the import as a string inside the code, but have the imports properly on top of the file"

> **Rule**: All imports must be static `import { X } from './y'` declarations at the top of the file. Dynamic `await import()` is only allowed for true lazy-load/code-splitting scenarios (e.g., large UI panels loaded on demand). Inline type imports like `import('./types').SomeType` in function signatures are NEVER allowed.

---

## Critical Violations — Inline Type Imports (Fix Immediately)

These are `import('./types').WorkspaceCredit` usages used as *type annotations* inside function signatures. They must be replaced with a proper `import type { WorkspaceCredit } from './types'` at the top of the file.

### `standalone-scripts/macro-controller/src/credit-parser.ts`
Lines: 93, 102, 126, 150, 233, 307, 346, 364, 381
```ts
// BEFORE
export function isExpiredWs(ws: import('./types').WorkspaceCredit): boolean {

// AFTER — add at top of file:
import type { WorkspaceCredit } from './types';
// then:
export function isExpiredWs(ws: WorkspaceCredit): boolean {
```

### `standalone-scripts/macro-controller/src/workspace-detection.ts`
Lines: 294, 313
```ts
// BEFORE
function handleSingleWorkspace(fn: string, perWs: import('./types').WorkspaceCredit[]): boolean {
// AFTER — add import type at top, remove inline import expression
```

### `standalone-scripts/macro-controller/src/ws-context-menu.ts`
Lines: 102, 106
```ts
// BEFORE
function isProOnePlan(ws: import('./types').WorkspaceCredit): boolean {
// AFTER — add import type at top
```

### `standalone-scripts/macro-controller/src/db/prompt-role-db.ts` (L81)
```ts
// BEFORE
export async function upsertForRole(input: import('./prompt-db').UpsertInput): Promise<EnforceResult> {
// AFTER — add import type { UpsertInput } from './prompt-db' at top
```

### `standalone-scripts/macro-controller/src/types/ui-types.ts` (L77)
```ts
// BEFORE
role?: import('./prompt-role').PromptRole;
// AFTER — add import type { PromptRole } from './prompt-role' at top of file
```

---

## Acceptable Dynamic Imports (DO NOT change these)
These are genuine lazy-load patterns — large UI modules loaded on user action to reduce initial bundle size:
- `chip-gear-menu.ts` — lazy loading `prompt-library-modal`, `seed-diagnostics-panel`, etc.
- `next-inline-ui.ts` — lazy loading `repeat-loop-ui`, `async-guard`
- `prompt-dropdown-io.ts` — lazy loading `prompt-io`, `prompt-io-zip`
- `prompt-dropdown-header.ts` — lazy loading `read-memory-admin-modal`
- `plan-task-ui.ts` — lazy loading `prompt-editor`
- `ui/database-data-filter.ts` — lazy loading `database-modal-data`

These are intentional code splits and should NOT be converted to static imports.

---

## Borderline Cases (Review Before Fixing)
These use `await import()` inside production functions but are NOT for UI lazy-loading. Evaluate if circular dependencies prevent static imports:
- `db/macro-db.ts:260` — `await import('./validate-read-memory-duplicates')` inside a function
- `db/macro-db.ts:276` — `await import('./migrate-legacy-read-memory')`
- `db/prompt-db.ts:311` — `await import('./prompt-revision-db')` inside `upsertPrompt`
- `db/prompt-role-db.ts:82` — `await import('./prompt-db')`
- `seed/reseed-command.ts:167` — `await import('./prompt-health-check')`

For each: check if moving to a static import causes a circular dependency. If yes, document the reason in a comment. If no, convert to static.

---

## Instructions for AI Fixer
1. Fix all inline type annotation imports first (Critical section above).
2. Add `import type { X } from './y'` at the top of each file.
3. Replace all `import('./types').SomeType` with just `SomeType`.
4. For borderline cases: run `tsc --noEmit` after converting each to static import to detect circular deps.
5. Run `pnpm run lint` after all changes.
6. Commit: `refactor: replace inline import expressions with top-level static imports`
