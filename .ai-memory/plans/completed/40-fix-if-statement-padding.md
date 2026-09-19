# Task: Enforce Blank Line Padding Before `if` Statements

Status: completed

## Goal
The codebase requires a new line gap before any `if` statement, provided it is not the very first line inside a block (e.g., right after a `{`). An audit has identified 1,711 violations across the codebase.

## Action Items
To fix this automatically and enforce it going forward:

1. Update `eslint.config.js` to strictly enforce the rule:
   ```javascript
   "padding-line-between-statements": [
     "error",
     { blankLine: "always", prev: "*", next: "if" },
     { blankLine: "any", prev: "block-like", next: "if" }
   ]
   ```
2. Run `pnpm run lint --fix` or `npx eslint . --fix` to automatically insert the missing newlines.
3. Review any remaining manual fixes required.
4. Verify with `tsc --noEmit` and `pnpm run lint`.
5. Commit the changes: `style: enforce blank line before if statements`
