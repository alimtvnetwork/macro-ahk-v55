# 78 – Move Inline Mirror Diagnostics Array Type in injection-handler

## Title
Move inline `MirrorDiagnosticLine` anonymous type to `handler-types.ts`

## Target File (primary edit)
`src/background/handlers/injection-handler.ts`

## Secondary File (type destination)
`src/background/handlers/handler-types.ts`

## Rule
**Rule 9 – Types Must Live in Their Own Files**
Inline anonymous object types used in variable declarations must be named and moved to a types file.

## Violation
| Location | Offending Code |
|----------|---------------|
| L693 | `const lines: Array<{ "msg": string; level: MirrorDiagnosticToTabLevelType }>` — inline anonymous object type |

The array element shape is defined anonymously inline, making it impossible to reuse or reference by name.

## Fix

### Step 1 – Define named type in `handler-types.ts`
```ts
// In src/background/handlers/handler-types.ts
export type MirrorDiagnosticLine = {
  msg: string;
  level: MirrorDiagnosticToTabLevelType;
};
```
> Ensure `MirrorDiagnosticToTabLevelType` is accessible in `handler-types.ts` (import it if needed).

### Step 2 – Import in `injection-handler.ts`
```ts
import type { MirrorDiagnosticLine } from "./handler-types";
```

### Step 3 – Update the variable declaration at L693
```ts
// Before
const lines: Array<{ "msg": string; level: MirrorDiagnosticToTabLevelType }> = [];

// After
const lines: MirrorDiagnosticLine[] = [];
```

## Instructions
1. Open `src/background/handlers/handler-types.ts` and add the `MirrorDiagnosticLine` export (Step 1).
2. Open `src/background/handlers/injection-handler.ts`.
3. Add the import (Step 2).
4. Update the variable declaration at L693 (Step 3).
5. Run `npm run lint`. Resolve any errors.
6. Run `tsc --noEmit` to confirm clean compilation.
7. Commit with message:
   ```
   fix(guidelines): move MirrorDiagnosticLine type to handler-types
   ```

## Notes
- The quoted key `"msg"` should be normalised to `msg` in the named type.
- This type is distinct from `PipelineLine` (subtasks 76–77) despite a structural similarity — keep them as separate named types.
