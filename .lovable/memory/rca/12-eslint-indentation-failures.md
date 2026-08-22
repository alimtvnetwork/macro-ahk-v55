# RCA: ESLint Indentation Failures

## Incident Overview
**Error:** `Expected indentation of X spaces but found Y` (236 errors across multiple background handlers).
**Phase:** CI/CD Linting Gate (`pnpm run lint`)
**Date:** 2026-08-22

## Root Cause
When the corrective `ts-morph` AST un-wrapper script was executed to safely strip the broken `ServiceResult.wrapDb()` injections across the codebase, it successfully restored the original structural AST nodes. 

However, `ts-morph` inherently relies on basic formatting rules when re-emitting the modified Abstract Syntax Tree back into strings. Because the script replaced deeply nested AST wrapper blocks, it collapsed the wrapper nodes but left behind hanging space artifacts (or defaulted to standard 4-space TypeScript formatting in environments expecting custom 2-space configurations), leading to 236 misaligned indentation markers across 9 handler files.

## Resolution
1. Ran `npx eslint --fix .` across the workspace to automatically apply the project's canonical `eslint.config.js` formatting rules to all modified files.
2. The linter correctly re-aligned all 236 lines (e.g., reverting the 10-space backtick strings back to 6-space alignment) to restore compliance.
3. Committed the styled files to `main`.

## Prevention
1. **Always chain linting to AST mutations:** When deploying mass AST refactoring scripts (like `ts-morph` or `jscodeshift`), they should always be strictly followed by a `lint --fix` pass before committing, as AST re-emitters are not reliable code formatters.
2. **Local CI simulation:** Pre-commit hooks should ideally gate formatting, but for speed, some projects bypass ESLint in `lint-staged`. When skipping standard workflows via direct commit pushes, always run a full `pnpm run lint` manually.
