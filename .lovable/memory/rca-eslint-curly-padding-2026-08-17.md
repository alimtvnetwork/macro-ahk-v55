# RCA: ESLint CI Failure (curly & padding-line-between-statements)

## Issue
The CI step `pnpm run lint` failed with errors in `src/background/handlers/sdk-bridge-handler.ts`. The violations were:
- `curly`: Expected `{` after `if` condition.
- `padding-line-between-statements`: Expected blank line before statement (e.g., before `return` or after block-like statements).

## Root Cause
Recent edits to `sdk-bridge-handler.ts` introduced single-line `if` statements without curly braces, which violates the `"curly": ["error", "all"]` rule enforced in `eslint.config.js`. Additionally, the edits missed blank lines before `return` statements or after block structures, violating the `padding-line-between-statements` rule.

## Resolution
1. Ran `pnpm run lint --fix` (which triggers `eslint . --fix`) to automatically repair the formatting.
2. ESLint successfully wrapped the single-line `if` statements in curly braces and injected the required newlines.
3. Verified the codebase is lint-clean (exit code 0).
