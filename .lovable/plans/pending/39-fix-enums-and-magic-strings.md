# Task: Refactor Magic Strings to Constants/Enums

## Goal
The codebase currently has multiple ESLint `sonarjs/no-duplicate-string` warnings. We need to extract these repeated magic strings into constants or Enums to improve type safety and maintainability.

## Findings
A recent audit found the following warnings in `eslint`:
- `src/background/auth-health-handler.ts`: String literal duplicated 5 times.
- `src/background/auto-injector.ts`: String literal duplicated 6 times.
- `src/background/boot.ts`: String literal duplicated 14 times.
- `src/background/context-menu-handler.ts`: String literal duplicated 5 times.

## Instructions for AI Subagent
1. Run `pnpm run lint` or `npx eslint .` to locate the exact lines and strings failing the `sonarjs/no-duplicate-string` rule.
2. For each violation, extract the string into a module-level `const` or an `enum` if it belongs to a related group of strings.
3. Replace all inline occurrences with the new constant/enum.
4. Verify the fixes by running `pnpm run lint`.
5. Commit the changes with the message `refactor: extract magic strings to constants to fix sonarjs warnings`.
