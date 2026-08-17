# 70 – Reuse requireGroupKey() Pattern in kv-handler (DRY)

## Title
Apply shared guard pattern (reuse `requireGroupKey()`) in `kv-handler`

## Target File
`src/background/handlers/kv-handler.ts`

## Rules
- **Rule 11 – DRY**
- **Rule 3 – Semantic Inverse Naming**

## Violation
Similar `!key` or `!group` patterns appear in `kv-handler.ts` that mirror the duplication fixed in `grouped-kv-handler.ts` (subtasks 68–69). These must be harmonised.

## Fix Options
Choose **one** of the following approaches based on the project's module structure:

### Option A – Import from shared location (preferred)
If a shared constants/helpers file exists (e.g. `src/background/handlers/handler-helpers.ts`), move `requireGroupKey()` there and import it in both `grouped-kv-handler.ts` and `kv-handler.ts`:

```ts
// handler-helpers.ts
export function requireGroupKey(
  group: string | undefined,
  key: string | undefined
): boolean {
  const isGroupMissing = !group;
  const isKeyMissing = !key;
  return !isGroupMissing && !isKeyMissing;
}

// kv-handler.ts
import { requireGroupKey } from "./handler-helpers";
```

### Option B – Local copy with cross-reference comment
If a shared helpers file is not appropriate, add a local copy with a comment:

```ts
// Same guard pattern as grouped-kv-handler.ts — see subtask 68/69 for context.
function requireGroupKey(
  group: string | undefined,
  key: string | undefined
): boolean {
  const isGroupMissing = !group;
  const isKeyMissing = !key;
  return !isGroupMissing && !isKeyMissing;
}
```

## Instructions
1. Audit `src/background/handlers/kv-handler.ts` for `!key` / `!group` guard patterns.
2. Decide on Option A or B based on the project's existing module structure.
3. Apply the chosen approach: extract/import helper, then replace all matching guard patterns.
4. If Option A: also update `grouped-kv-handler.ts` to import from the shared location.
5. Run `npm run lint`. Fix any errors.
6. Run `npm test` if available.
7. Commit with message:
   ```
   fix(guidelines): apply shared guard pattern in kv-handler
   ```

## Notes
- Document the chosen option (A or B) in the commit message body.
- If `kv-handler.ts` has no `!key` / `!group` patterns upon audit, record this finding and close the subtask with a "no-op" commit noting the audit result.
