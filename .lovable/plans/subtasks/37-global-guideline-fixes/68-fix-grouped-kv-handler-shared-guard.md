# 68 – Extract requireGroupKey() Shared Guard in grouped-kv-handler (DRY)

## Title
Extract `requireGroupKey()` shared guard helper in `grouped-kv-handler`

## Target File
`src/background/handlers/grouped-kv-handler.ts`

## Rule
**Rule 11 – DRY (Don't Repeat Yourself)**
Guard logic that is duplicated 5 or more times across functions in the same file must be extracted into a private helper function.

## Violation
The patterns `if (!group)` and `if (!key)` are each repeated **5 or more times** across different functions in `grouped-kv-handler.ts`, violating DRY.

## Fix
Add the following private helper function near the top of the file (after imports, before the first exported function):

```ts
function requireGroupKey(
  group: string | undefined,
  key: string | undefined
): boolean {
  const isGroupMissing = !group;
  const isKeyMissing = !key;
  return !isGroupMissing && !isKeyMissing;
}
```

> **Return value semantics:** Returns `true` when both `group` and `key` are present (i.e. the call is valid), and `false` when either is absent.

### Replacing call sites
Each existing guard that looks like:
```ts
if (!group) { return; }
if (!key) { return; }
```
or equivalent, should be replaced with:
```ts
if (!requireGroupKey(group, key)) { return; }
```

Apply this replacement consistently — see subtask 69 for the follow-up that replaces all remaining call sites.

## Instructions
1. Open `src/background/handlers/grouped-kv-handler.ts`.
2. Add the `requireGroupKey()` helper function as described above.
3. Replace the **first** set of `!group` / `!key` guards with a call to `requireGroupKey()`.
4. Run `npm run lint`. Fix any type or lint errors (e.g. adjust parameter types to match actual signatures).
5. Commit with message:
   ```
   fix(guidelines): extract requireGroupKey() DRY helper in grouped-kv-handler
   ```

## Notes
- The full replacement of all call sites is handled in subtask 69.
- Parameter types (`string | undefined`) should be adjusted if the actual types differ (e.g. `string | null`).
- The helper must be `function`-scoped (not arrow) to aid readability and hoisting.
