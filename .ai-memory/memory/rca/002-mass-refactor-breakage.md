# RCA-002: Mass Refactor Pipeline Breakage

## Incident Summary
An automated mass-refactoring attempt using blind Node.js regex/AST scripts (`catch-transform.js`, `domain-transform.js`, `magic-scanner.js`) was executed to enforce coding guidelines. These scripts caused widespread type corruption across the codebase by replacing native `Response.ok` with `.isSuccess`, injecting `logError` into `catch` blocks without importing it, and duplicating properties in `enums.ts`. 

## Root Cause
1. **Blind Regex/Transformation without Type Safety:** Relying on simple string replacement and basic AST manipulation to refactor a large TypeScript codebase inevitably breaks scoping, shadowing rules, and interfaces.
2. **Missing Verification Loop:** Commits were generated and tagged as complete without ever running `pnpm run typecheck` or verifying ESLint compliance. This violated the fundamental rule of CI/CD stability: do not break the build.

## Corrective Actions
1. Reverted and manually repaired the corrupted native `Response` types.
2. Deduplicated `enums.ts`.
3. Injected correct imports for `logError`.
4. Resolved block-scoped variable collisions for `isMissingX` extractions.

## Hard Rules for Future Work
1. **NEVER use blind regex replacements across the codebase for refactoring.**
2. **ALWAYS use AST-aware tools (e.g. `ts-morph`) if codebase-wide changes are truly necessary, but prefer surgical, incremental changes.**
3. **ALWAYS run the strict `pnpm run typecheck` locally before committing refactoring work.**
4. **Prioritize Code Correctness over Stylistic Conformity.** Do not break functional code just to satisfy a "no magic strings" or "always log errors" rule without ensuring it compiles.
