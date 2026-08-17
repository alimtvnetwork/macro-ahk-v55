# 53 – Extract isValidDumpResponse() in macro-db

## Target
`standalone-scripts/macro-controller/src/db/macro-db.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L454 | `if (resp && resp.ok && resp.dump)` |

Three `&&` operands (truthy check + property checks) in a single `if` condition.

## Fix

Replace with a named boolean constant immediately before the `if`:

```ts
const isValidDumpResponse = resp !== null && resp.ok === true && resp.dump !== undefined;
if (isValidDumpResponse) {
```

> **Note:** Loose truthy checks (`resp &&`, `resp.dump`) are tightened to explicit checks (`resp !== null`, `resp.dump !== undefined`) for clarity. If `resp.ok` is typed as `boolean` already, `=== true` is optional but makes the intent explicit.

## Instructions

1. Locate L454 in `macro-db.ts`.
2. Replace the inline triple-`&&` condition with the named `isValidDumpResponse` constant shown above.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isValidDumpResponse in macro-db
   ```
