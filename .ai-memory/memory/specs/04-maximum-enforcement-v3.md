# Maximum Enforcement v3.0

> Captured from User Directive (Session 2026-08-09)

## Directive
"Fix the git status first, then start coding. Make a big plan if required to self-loop, and spawn sub-agents with parallel processing to speed up the work...
Look into the entire codebase and follow the code review guidelines from the aspect folder properly. All caught errors must be explicitly logged following the guidelines in the error manage folder. Create a wrapper for queries in PHP/Python/TS that automatically logs failures to reduce scattered logging code.

Make sure the code quality is strictly maintained:
1. Do not introduce any magic strings or magic numbers anywhere unless it is explicitly for the logger, and mention that in the typing.
2. In TypeScript, rather than using strings as sub-items or comparing string union types (pipes) like 'pass' | 'fail' | 'fallback', you must use Enums. Enums are the best.
3. Every single Enum must end with the suffix 'Type'.
4. Always use explicit boolean state checks like response.isFail or explicit checks rather than inverting success booleans like !response.isSuccess.

when you are writing anything to the file system, why you have to write from file, file? You just use slash and from the root of the repo, it would be automatically fixed. Make sure you follow this rule in the future because the code needs to be standalone, not from a file system."

## Rules
- **No ile:/// URIs:** Never write absolute paths. Always use repo-relative paths (/src/...).
- **Enums Required:** String union types are banned. Use Enums, and they must end with Type.
- **Explicit Boolean State Checks:** Do not invert success flags (!resp.isSuccess). Use esp.isFail.
