# CI/CD Failure Guide & Root Causes

**Context:** This project has exceptionally strict CI/CD gates that frequently cause pipeline failures if developers or AI agents are not meticulously adhering to the codebase standards. This document serves as a guide for future AIs to understand *why* CI/CD fails and *how* to prevent it.

## Common Root Causes of CI/CD Failures

### 1. Strict TypeScript Compliance (`tsc --noEmit`)
The project enforces strict type checking.
- **No `any` or `unknown`**: Using `any` or `unknown` in business logic will cause type check failures. Always use generics or well-defined interfaces.
- **No Nullable Booleans**: Booleans cannot be `boolean | null` or `boolean | undefined`. They must strictly be `boolean` and default to `false`.

### 2. Strict ESLint Rules
The ESLint configuration has custom rules that will break the build if violated:
- **No Magic Strings / Duplicate Strings**: Hardcoding strings that are used multiple times (e.g., event names, action types) triggers `sonarjs/no-duplicate-string`. These must be extracted into `const` variables or `enum`s.
- **No Nested Template Literals**: Using nested template literals (e.g., ``` `outer ${`inner`} ` ```) is strictly banned in new code.
- **Max Lines Per Function**: Functions cannot exceed 40 lines. Break them down.
- **Padding Before `if` Statements**: There must be a blank newline before an `if` statement, unless it is the first line inside a block (e.g., right after a `{`).

### 3. Architecture Rules (Code Red)
- **Rule 3 (No raw `!`):** You cannot use `!variable` in an if-condition. It must be extracted into a positively named boolean (e.g., `const isMissing = !variable; if (isMissing)`).
- **Rule 0:** You must not use inline `console.error`. Use the internal Logger instead.

### 4. Git State & Orphaned Files
- The CI pipeline expects a perfectly clean working tree. If temporary files (like `.lovable/temp/`) are not in `.gitignore`, the CI will fail.

## How Future AIs Should Proceed
1. **Never skip running the linter** (`pnpm run lint`) and TS compiler (`tsc --noEmit`) before committing.
2. **If a test fails**, do not attempt to bypass it. Read the test output, identify the broken logic, and fix it.
3. **Check for missing constants**: If you are typing a string more than twice, put it in a constant or enum.
4. **Follow padding rules**: Always insert a newline before an `if` block.
