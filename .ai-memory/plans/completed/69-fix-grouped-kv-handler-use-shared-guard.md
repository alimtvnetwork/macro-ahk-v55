# 69 – Replace All !group/!key Negations Using requireGroupKey() in grouped-kv-handler

## Title
Replace all remaining `!group` / `!key` negations with `requireGroupKey()` calls in `grouped-kv-handler`

## Target File
`src/background/handlers/grouped-kv-handler.ts`

## Rules
- **Rule 3 – Semantic Inverse Naming**
- **Rule 11 – DRY**

## Prerequisite
Subtask **68** must be completed first (i.e. `requireGroupKey()` helper must already exist in the file).

## Violation
All remaining occurrences of `if (!group)` and `if (!key)` that were not replaced in subtask 68.

## Fix
For every remaining location where `group` or `key` is individually negated in a guard condition, replace with a unified call to `requireGroupKey()`:

```ts
// Before (any variant)
if (!group) { /* early return or throw */ }
if (!key)   { /* early return or throw */ }

// After
if (!requireGroupKey(group, key)) { /* early return or throw */ }
```

If a location only checks `!group` (no `!key` check), replace with:
```ts
const isGroupMissing = !group;
if (isGroupMissing) { /* ... */ }
```
following Rule 3, rather than calling `requireGroupKey()` with an irrelevant `key`.

## Instructions
1. Open `src/background/handlers/grouped-kv-handler.ts`.
2. Search the entire file for `!group` and `!key` in `if` conditions.
3. Replace each with the appropriate call to `requireGroupKey(group, key)` (or Rule 3 extraction if only one parameter applies).
4. Run `npm run lint`. Fix any errors.
5. Run the test suite if available: `npm test`.
6. Confirm no behavioural change.
7. Commit with message:
   ```
   fix(guidelines): use requireGroupKey() for all guards in grouped-kv-handler
   ```

## Notes
- After this subtask, no bare `if (!group)` or `if (!key)` should remain in this file.
- If a guard serves a different semantic purpose (e.g. a different early-exit condition unrelated to the group/key pair), leave it unchanged and document the exception in the commit message body.
