# 73 – Replace Magic Number 3 (JWT segments) with JWT_SEGMENT_COUNT in config-auth-handler

## Title
Replace magic number `3` (JWT segment count) with `JWT_SEGMENT_COUNT` constant in `config-auth-handler`

## Target File
`src/background/handlers/config-auth-handler.ts`

## Rule
**Rule 8 – No Magic Numbers**
Domain-specific numeric literals must be replaced with named constants that communicate their meaning.

## Violation
The expression `token.split(".").length === 3` uses the literal `3` to validate that a JWT token has the expected three dot-separated segments (header, payload, signature). Without a named constant, a future reader cannot immediately understand what `3` represents.

## Fix
Add a named constant near the top of the file (after imports, with other constants):

```ts
/** A well-formed JWT consists of exactly 3 dot-separated segments: header, payload, signature. */
const JWT_SEGMENT_COUNT = 3;
```

Then replace the literal:

```ts
// Before
if (token.split(".").length === 3) {

// After
if (token.split(".").length === JWT_SEGMENT_COUNT) {
```

## Instructions
1. Open `src/background/handlers/config-auth-handler.ts`.
2. Add `const JWT_SEGMENT_COUNT = 3;` (with the JSDoc comment above) near the top of the file.
3. Search for `=== 3` in the context of `token.split(".")` and replace with `=== JWT_SEGMENT_COUNT`.
4. Verify no other unrelated `=== 3` expressions are accidentally changed.
5. Run `npm run lint`. Resolve any issues.
6. Confirm no logic change.
7. Commit with message:
   ```
   fix(guidelines): replace magic JWT_SEGMENT_COUNT in config-auth-handler
   ```

## Notes
- The JSDoc comment explaining the JWT structure is required — it's the documentation that makes the constant genuinely self-documenting.
- See subtask 74 for the companion fix replacing `20` with `MIN_TOKEN_LENGTH` in the same file.
