# 74 – Replace Magic Number 20 with MIN_TOKEN_LENGTH in config-auth-handler

## Title
Replace magic number `20` with `MIN_TOKEN_LENGTH` constant in `config-auth-handler`

## Target File
`src/background/handlers/config-auth-handler.ts`

## Rule
**Rule 8 – No Magic Numbers**

## Violation
The expression `raw.length < 20` uses the literal `20` as a minimum acceptable token length. This value is a domain-specific threshold that should be named.

## Fix
Add a named constant near the top of the file (alongside `JWT_SEGMENT_COUNT` added in subtask 73):

```ts
/** Minimum character length for a raw auth token to be considered potentially valid. */
const MIN_TOKEN_LENGTH = 20;
```

Then replace the literal:

```ts
// Before
if (raw.length < 20) {

// After
if (raw.length < MIN_TOKEN_LENGTH) {
```

## Instructions
1. Open `src/background/handlers/config-auth-handler.ts`.
2. Add `const MIN_TOKEN_LENGTH = 20;` (with JSDoc comment) near the top of the file.
3. Find `raw.length < 20` and replace with `raw.length < MIN_TOKEN_LENGTH`.
4. Check for any other occurrences of the literal `20` used in a token-length context and replace those too.
5. Run `npm run lint`. Resolve any issues.
6. Confirm no logic change.
7. Commit with message:
   ```
   fix(guidelines): replace magic MIN_TOKEN_LENGTH in config-auth-handler
   ```

## Notes
- `MIN_TOKEN_LENGTH` is also used in `token-seeder.ts` (see subtask 75). Consider whether to move this constant to a shared file now or leave that to subtask 75.
- Do **not** replace unrelated occurrences of `20` elsewhere in the file (e.g. array indices, port numbers).
