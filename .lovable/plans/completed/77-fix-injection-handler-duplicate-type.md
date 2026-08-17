# 77 – Remove Duplicate PipelineLine Type Definition in injection-handler

## Title
Remove duplicate `PipelineLine` type definition at L451 in `injection-handler`

## Target File
`src/background/handlers/injection-handler.ts`

## Rules
- **Rule 11 – DRY**
- **Rule 9 – Types Must Live in Their Own Files**

## Prerequisite
Subtask **76** must be completed first: `PipelineLine` must already be exported from `handler-types.ts` and imported in `injection-handler.ts`.

## Violation
| Location | Offending Code |
|----------|---------------|
| L451 | `type PipelineLine = { "msg": string; level: PipelineLineLevelType }` — a second, identical definition of the same type |

Having two definitions of the same type in one file is both a DRY violation and redundant after the move performed in subtask 76.

## Fix
Delete the duplicate type definition at L451:

```ts
// Remove this entire line (and any blank lines immediately dedicated to it):
type PipelineLine = { "msg": string; level: PipelineLineLevelType };
```

The `PipelineLine` type is already available via the import added in subtask 76:
```ts
import type { PipelineLine } from "./handler-types";
```

## Instructions
1. Open `src/background/handlers/injection-handler.ts`.
2. Confirm that the import from subtask 76 is present.
3. Locate L451 (line number may have shifted slightly after subtask 76's edits — search for the second `type PipelineLine`).
4. Delete the duplicate type declaration.
5. Run `npm run lint`. Fix any `duplicate identifier` or `unused import` errors.
6. Run `tsc --noEmit` (or `npm run build`) to confirm the file type-checks cleanly.
7. Commit with message:
   ```
   fix(guidelines): remove duplicate PipelineLine type in injection-handler
   ```

## Notes
- Do not remove the **import** — only the duplicate local `type` declaration.
- If the line numbers have shifted due to subtask 76, use a text search for `type PipelineLine` to find the second occurrence.
