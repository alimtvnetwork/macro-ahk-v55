# 46 – Extract isValidProjectProbe() to Fix 4-part && at L185 in open-tabs-handler

## Target
`src/background/handlers/open-tabs-handler.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L185 | `if (projectId === null && probePayload && typeof probePayload.projectId === "string" && probePayload.projectId !== "")` |

Four `&&` operands chained in a single `if` condition.

## Fix

Decompose into two named booleans before the `if`:

```ts
const isProjectIdAbsent = projectId === null;
const isValidProjectProbe =
  probePayload !== null &&
  typeof probePayload.projectId === 'string' &&
  probePayload.projectId !== '';
if (isProjectIdAbsent && isValidProjectProbe) {
```

> **Note:** `probePayload !== null` replaces the loose-truthy `probePayload &&` for precision.
> `isValidProjectProbe` itself still contains 3 operands — if Rule 3 is strict, consider extracting a further helper; however, the primary violation (4 operands in one `if`) is resolved here.

## Instructions

1. Locate L185 in `open-tabs-handler.ts`.
2. Replace the 4-part `if` with the two named booleans and the simplified `if` shown above.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isValidProjectProbe guard in open-tabs-handler
   ```
