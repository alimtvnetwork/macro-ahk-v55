# 75 – Reuse MIN_TOKEN_LENGTH Constant in token-seeder

## Title
Use `MIN_TOKEN_LENGTH` constant in `token-seeder` (DRY)

## Target File
`src/background/handlers/token-seeder.ts`

## Rules
- **Rule 8 – No Magic Numbers**
- **Rule 11 – DRY**

## Violation
| Location | Offending Code |
|----------|---------------|
| L245 | `raw.length < 20` |

The same magic number `20` used as minimum token length in `config-auth-handler.ts` (subtask 74) is repeated here, violating DRY.

## Fix — Two Options

### Option A – Import from a shared constants file (preferred)
Create or extend `src/background/handlers/handler-constants.ts` (or equivalent shared file):

```ts
// handler-constants.ts
/** Minimum character length for a raw auth token to be considered potentially valid. */
export const MIN_TOKEN_LENGTH = 20;
```

Then import it in both `config-auth-handler.ts` and `token-seeder.ts`:

```ts
import { MIN_TOKEN_LENGTH } from "./handler-constants";
```

Update `config-auth-handler.ts` (originally fixed in subtask 74) to use the import instead of a local declaration.

### Option B – Local copy with cross-reference comment
If a shared constants file is not appropriate:

```ts
// token-seeder.ts
// Same threshold as MIN_TOKEN_LENGTH in config-auth-handler.ts (Rule 8 / subtask 74).
const MIN_TOKEN_LENGTH = 20;
```

## Instructions
1. Decide on Option A or B based on the project's module structure.
2. Apply the fix at L245 in `src/background/handlers/token-seeder.ts`.
3. If Option A: also update `config-auth-handler.ts` to import from the shared file.
4. Run `npm run lint`. Resolve any issues.
5. Run `npm test` if available.
6. Commit with message:
   ```
   fix(guidelines): use MIN_TOKEN_LENGTH constant in token-seeder
   ```

## Notes
- Document the chosen option in the commit message body.
- The constant value `20` must not be changed — only the form (literal → named constant) changes.
