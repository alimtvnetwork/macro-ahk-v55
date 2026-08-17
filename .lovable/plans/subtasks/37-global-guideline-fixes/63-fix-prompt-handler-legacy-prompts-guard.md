# 63 – Extract isLegacyPromptsAbsent Guard in prompt-handler

## Title
Extract `isLegacyPromptsAbsent` guard in `prompt-handler`

## Target File
`src/background/handlers/prompt-handler.ts`

## Rule
**Rule 3 – Semantic Inverse Naming**
Compound negative/guard expressions used directly as `if` conditions must be extracted into a named boolean variable.

## Violation
| Location | Offending Code |
|----------|---------------|
| L322 | `if (!Array.isArray(legacyPrompts) \|\| legacyPrompts.length === 0)` |

The compound expression mixes a type-check negation with an empty-check, obscuring the higher-level intent ("no usable legacy prompts").

## Fix

```ts
// Before
if (!Array.isArray(legacyPrompts) || legacyPrompts.length === 0) {

// After
const isLegacyPromptsAbsent = !Array.isArray(legacyPrompts) || legacyPrompts.length === 0;
if (isLegacyPromptsAbsent) {
```

## Instructions
1. Open `src/background/handlers/prompt-handler.ts`.
2. Locate L322 with the compound guard.
3. Insert `const isLegacyPromptsAbsent = ...;` on the line immediately before the `if`, then simplify the `if` condition to `isLegacyPromptsAbsent`.
4. Run `npm run lint`. Resolve any lint warnings.
5. Confirm no behavioural change.
6. Commit with message:
   ```
   fix(guidelines): extract isLegacyPromptsAbsent in prompt-handler
   ```

## Notes
- The variable name `isLegacyPromptsAbsent` must be used exactly as specified.
- Do not alter the logic of the compound expression itself; only extract it.
