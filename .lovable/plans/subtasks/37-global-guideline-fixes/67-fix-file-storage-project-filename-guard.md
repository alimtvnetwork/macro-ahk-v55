# 67 – Verify Compound Project/Filename Guard in file-storage-handler

## Title
Verify compound project/filename guard in `file-storage-handler` (follow-up to subtask 60)

## Target File
`src/background/handlers/file-storage-handler.ts`

## Rule
**Rule 3 – Semantic Inverse Naming**

## Context
Subtask **60** was responsible for extracting the compound `projectId` guard at L224 of `file-storage-handler.ts`. This subtask exists to verify that fix has been applied correctly and to record an integration note.

## Verification Checklist
- [ ] L224 no longer contains a bare compound negation such as `if (!projectId || ...)`.
- [ ] A named boolean variable (e.g. `isProjectContextMissing` or similar) has been introduced in place of the inline condition.
- [ ] The extracted variable follows Rule 3 naming conventions (positive-inverse name, `is...` prefix).
- [ ] No lint errors are present in the file.
- [ ] The surrounding logic is unchanged.

## Integration Note
If subtask 60 has **not** yet been applied, apply it now following the same pattern:

```ts
// Example pattern (adapt to actual variable names at L224)
const isProjectContextMissing = !projectId || !filename;
if (isProjectContextMissing) {
```

## Instructions
1. Open `src/background/handlers/file-storage-handler.ts`.
2. Inspect L224 (and nearby lines) for the compound projectId guard.
3. If subtask 60 was already applied: confirm compliance, run `npm run lint`, and record a verification note in the PR description.
4. If subtask 60 was **not** applied: apply the extraction now following the pattern above.
5. Run `npm run lint`. Fix any errors.
6. Commit only if changes were needed:
   ```
   fix(guidelines): verify compound project guard in file-storage-handler
   ```

## Notes
- This subtask is a verification/integration gate, not necessarily a new code change.
- Document the outcome (applied / already done) in the commit message body.
