# 56 – Extract isValidFiniteHeight() in projects-cache

## Target
`standalone-scripts/macro-controller/src/projects-cache.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L45 | `if (typeof h === 'number' && Number.isFinite(h) && h >= 0)` |

Three `&&` operands (type check + finiteness check + range check) in a single `if` condition.

## Fix

Create a type-predicate helper at the top of the file:

```ts
function isValidFiniteHeight(h: unknown): h is number {
  return (
    typeof h === 'number' &&
    Number.isFinite(h) &&
    h >= 0
  );
}
```

Replace the violation site:

```ts
// Before
if (typeof h === 'number' && Number.isFinite(h) && h >= 0)

// After
if (isValidFiniteHeight(h))
```

The type predicate `h is number` also narrows the type of `h` inside the `if` block.

## Instructions

1. Add the `isValidFiniteHeight` helper after the import block in `projects-cache.ts`.
2. Replace the triple-`&&` condition at L45 with `if (isValidFiniteHeight(h))`.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isValidFiniteHeight helper in projects-cache
   ```
