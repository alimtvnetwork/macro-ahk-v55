# 66 – Extract isCallerContextMissing Compound Guard in dynamic-require-handler

## Title
Extract `isCallerContextMissing` compound guard in `dynamic-require-handler`

## Target File
`src/background/handlers/dynamic-require-handler.ts`

## Rule
**Rule 3 – Semantic Inverse Naming**
Triple negation compound conditions must be extracted into a semantically named variable.

## Violation
| Location | Offending Code |
|----------|---------------|
| L57 | `if (!target \|\| !requesterProjectId \|\| !tabId)` |

Three separate negations are combined without a name that communicates the unified guard's meaning.

## Fix

```ts
// Before
if (!target || !requesterProjectId || !tabId) {

// After
const isCallerContextMissing = !target || !requesterProjectId || !tabId;
if (isCallerContextMissing) {
```

## Instructions
1. Open `src/background/handlers/dynamic-require-handler.ts`.
2. Locate L57 containing the triple-negation guard.
3. Insert `const isCallerContextMissing = ...;` directly above the `if`, then update the condition.
4. Run `npm run lint`. Fix any errors.
5. Confirm pure rename with no logic change.
6. Commit with message:
   ```
   fix(guidelines): extract isCallerContextMissing in dynamic-require-handler
   ```

## Notes
- Variable name `isCallerContextMissing` is canonical.
- All three operands (`target`, `requesterProjectId`, `tabId`) must remain in the extracted expression unchanged.
