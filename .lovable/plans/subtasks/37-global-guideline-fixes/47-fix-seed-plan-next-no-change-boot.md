# 47 – Extract isNoChangeBoot() to Fix 4-part Compound at L445 in seed-plan-next

## Target
`standalone-scripts/macro-controller/src/seed/seed-plan-next.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition; avoid mixing positive and negative operands.

## Violation

| Location | Code |
|----------|------|
| L445 | `if (!isFailure && params.inserted === 0 && params.promoted === 0 && params.upgraded === 0)` |

Four `&&` operands with mixed polarity (negation plus three equality checks).

## Fix

Decompose into two named booleans before the `if`:

```ts
const isBootSuccessful = !isFailure;
const isNoNewData =
  params.inserted === 0 &&
  params.promoted === 0 &&
  params.upgraded === 0;
const isNoChangeBoot = isBootSuccessful && isNoNewData;
if (isNoChangeBoot) {
```

Each variable is now self-documenting and no single expression exceeds 3 `&&` operands.

> **Note:** `isNoNewData` still uses 3 `&&` operands. If Rule 3 is strict-2, further split into `const isNothingInserted = params.inserted === 0; const isNothingPromotedOrUpgraded = params.promoted === 0 && params.upgraded === 0;`.

## Instructions

1. Locate L445 in `seed-plan-next.ts`.
2. Replace the single `if` statement with the decomposition shown above.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isNoChangeBoot in seed-plan-next
   ```
