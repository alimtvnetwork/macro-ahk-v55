# RCA: ESLint CI Failure (no-multiple-empty-lines)

## Issue
The CI failed with 6 errors in `standalone-scripts` files, all related to the `no-multiple-empty-lines` ESLint rule (e.g., "Too many blank lines at the beginning of file").

## Root Cause
1. **Formatting drift**: Blank lines accumulated at the top or between lines in several TS files (`plan-more-popover.ts`, `task-next-ui.ts`, etc.) during recent refactors.
2. **ESLint 9 Flat Config Bug**: When running `npx eslint --fix`, ESLint successfully fixed the TS blank line errors but subsequently failed on `01-macro-looping.js` and `dist/macro-looping.js` with `Definition for rule 'sonarjs/no-duplicate-string' was not found`. This happened because ESLint 9's flat config default behavior scans `.js` files if no extensions are explicitly scoped at the CLI level, and encounters inline `eslint-disable` comments for `sonarjs` rules in the generated JS build artifacts. The `sonarjs` plugin wasn't loaded globally for `.js` files, causing the rule definition error.

## Resolution
1. Ran `npx eslint standalone-scripts --fix` to automatically repair the `no-multiple-empty-lines` spacing violations in the TS source code.
2. Updated `eslint.config.js` to explicitly ignore `standalone-scripts/**/*.js` globally, preventing ESLint from parsing and failing on generated JS bundles that contain disabled rules for plugins restricted to TS files.
3. Verified `npx eslint standalone-scripts --max-warnings=0 --format=stylish` passes locally with 0 errors and 0 warnings.
