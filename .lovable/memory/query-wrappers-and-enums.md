# Memory: Coding Guidelines & Lessons Learned

## Strict Error Management
- All caught errors must be explicitly logged following the guidelines in the `error manage` folder. No empty catch blocks are allowed.
- Do not swallow errors without logging.

## Query Wrappers
- Create and use a wrapper for queries in PHP/Python/TS that automatically logs failures.
- This prevents scattered logging code throughout the codebase and ensures failures are always logged uniformly at the source.

## Strict Boolean Checks (`isFail`)
- Use explicit `isFail` properties for checking failure states (e.g., `response.isFail`).
- NEVER use inverted `isSuccess` checks (e.g., avoid `!response.isSuccess`).

## TypeScript Enums
- Replace TypeScript string union types (e.g., `"pass" | "fail" | "fallback"`) with Enums.
- Every single Enum must end with the suffix `"Type"` (e.g., `StatusType` instead of `Status`).

## Avoid Magic Strings/Numbers
- Do not introduce magic strings or magic numbers anywhere unless explicitly used directly for logging.
- For types, extract them into constants or Enums.

## Code Quality & Consistency
- Constants should be reused and not duplicated.
- Keep the code DRY (Don't Repeat Yourself) at all times.
- Ensure any similar code changes are committed together, not as individual single-file commits, with a descriptive commit message.
- Git must remain the single source of truth; do not leave local uncommitted changes before ending tasks.
