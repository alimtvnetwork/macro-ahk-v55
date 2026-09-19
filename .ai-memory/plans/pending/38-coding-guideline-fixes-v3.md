# Plan: Coding Guideline Enforcement (v3)

## Goal
Resolve 200 concrete coding guideline violations across the codebase, specifically targeting `any-type`, `inverted-boolean`, `swallowed-error`, `nested-if`, and `restricted-identifier`.

## Root Cause & Fallout Analysis

### 1. `any` Type Usage
- **Root Cause**: Developer bypassed strict typing for convenience or lacked a proper interface definition.
- **Fallout Radius**: May break compilation if the newly narrowed type exposes property access errors elsewhere. CI/CD will fail on `tsc` if the new type is incompatible.

### 2. Inverted Booleans
- **Root Cause**: Negative framing was used during initial implementation without refactoring to a positive state.
- **Fallout Radius**: Changes require flipping the boolean logic at all call sites. If a site is missed, runtime logic will invert, potentially breaking E2E tests.

### 3. Swallowed Errors
- **Root Cause**: Empty catch block or bare console.error used instead of the mandated RiseupAsiaMacroExt.Logger.error.
- **Fallout Radius**: Missing diagnostic logs in production. CI script `audit-error-swallow.mjs` fails. Fixing it requires injecting Logger context which might be missing.

### 4. Nested If Statements
- **Root Cause**: Incremental feature additions led to deeper nesting instead of early returns (guard clauses).
- **Fallout Radius**: Refactoring to early returns could accidentally alter execution order if side effects exist. Requires careful mapping of all branches.

### 5. Restricted Identifiers
- **Root Cause**: Developer used shorthand (e.g. `cb`, `arr`, `el`) instead of descriptive domain names.
- **Fallout Radius**: Renaming identifiers might cause reference errors if shadowed variables exist. Safe rename (F2) equivalent required.

## Execution Strategy
- Tasks are enqueued in `.lovable/spec/tasks/38-coding-guideline-fixes-v3.md`.
- 3 sub-agents will be spawned to process these sequentially in batches.

