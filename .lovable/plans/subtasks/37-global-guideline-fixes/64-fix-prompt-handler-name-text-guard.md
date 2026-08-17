# 64 – Extract isNameOrTextMissing Guard in prompt-handler

## Title
Extract `isNameOrTextMissing` guard in `prompt-handler`

## Target File
`src/background/handlers/prompt-handler.ts`

## Rule
**Rule 3 – Semantic Inverse Naming**
Bare negations in `if` conditions must be extracted into a semantically named boolean variable.

## Violation
| Location | Offending Code |
|----------|---------------|
| L498 | `if (!name \|\| !text)` |

Two separate bare negations are combined in a single condition without expressing the combined meaning.

## Fix

```ts
// Before
if (!name || !text) {

// After
const isNameOrTextMissing = !name || !text;
if (isNameOrTextMissing) {
```

## Instructions
1. Open `src/background/handlers/prompt-handler.ts`.
2. Locate L498 containing `if (!name || !text)`.
3. Insert the extracted variable declaration immediately above the `if`, then update the condition.
4. Run `npm run lint`. Fix any lint issues.
5. Confirm logic is unchanged.
6. Commit with message:
   ```
   fix(guidelines): extract isNameOrTextMissing in prompt-handler
   ```

## Notes
- Variable name `isNameOrTextMissing` is canonical.
- The existing `name` and `text` variables remain untouched; only the guard expression changes.
