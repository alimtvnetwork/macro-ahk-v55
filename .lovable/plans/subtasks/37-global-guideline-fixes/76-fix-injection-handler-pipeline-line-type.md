# 76 – Move PipelineLine Type to Types File in injection-handler

## Title
Move `PipelineLine` type to `handler-types.ts` in `injection-handler`

## Target File (primary edit)
`src/background/handlers/injection-handler.ts`

## Secondary File (type destination)
`src/background/handlers/handler-types.ts`

## Rule
**Rule 9 – Types Must Live in Their Own Files**
Type aliases defined inline inside implementation files (especially inside function/scope bodies) must be moved to a dedicated types file and imported.

## Violation
| Location | Offending Code |
|----------|---------------|
| L302 | `type PipelineLine = { "msg": string; level: PipelineLineLevelType }` — defined inline inside a function or local scope |

## Fix

### Step 1 – Add type to `handler-types.ts`
```ts
// In src/background/handlers/handler-types.ts
export type PipelineLine = {
  msg: string;
  level: PipelineLineLevelType;
};
```
> Ensure `PipelineLineLevelType` is already exported from `handler-types.ts` (or imported from its own source before re-exporting).

### Step 2 – Import in `injection-handler.ts`
```ts
import type { PipelineLine } from "./handler-types";
```

### Step 3 – Remove inline definition
Delete the `type PipelineLine = ...` declaration at L302 in `injection-handler.ts`.

## Instructions
1. Open `src/background/handlers/handler-types.ts`.
2. Add the exported `PipelineLine` type (Step 1).
3. Open `src/background/handlers/injection-handler.ts`.
4. Add the import statement (Step 2).
5. Remove the inline type definition at L302 (Step 3).
6. Run `npm run lint`. Resolve any missing-import or duplicate-identifier errors.
7. Confirm the file still compiles: `npm run build` or `tsc --noEmit`.
8. Commit with message:
   ```
   fix(guidelines): move PipelineLine type to handler-types
   ```

## Notes
- See subtask 77 for removing the **duplicate** `PipelineLine` definition at L451 — that is a separate commit.
- The string key `"msg"` should be normalised to an unquoted key `msg` in the type destination if not already so.
