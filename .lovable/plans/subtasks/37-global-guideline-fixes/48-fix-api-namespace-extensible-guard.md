# 48 – Extract isNonExtensibleObject() to Fix Triple && at L122/134 in api-namespace

## Target
`standalone-scripts/macro-controller/src/api-namespace.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violations

| Location | Code |
|----------|------|
| L122 | `if (child && typeof child === 'object' && !Object.isExtensible(child))` |
| L134 | Same pattern repeated |

Three `&&` operands (truthy check + type check + negated extensibility check) at two separate call sites.

## Fix

Create a named helper at the top of the file:

```ts
function isNonExtensibleObject(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Object.isExtensible(value as object)
  );
}
```

Replace both violation sites:

```ts
// Before (L122 and L134)
if (child && typeof child === 'object' && !Object.isExtensible(child))

// After
if (isNonExtensibleObject(child))
```

> **Note:** `value !== null` replaces the loose-truthy `value &&` to be type-safe.

## Instructions

1. Add the `isNonExtensibleObject` helper after the import block in `api-namespace.ts`.
2. Replace the triple-`&&` condition at **L122**.
3. Replace the triple-`&&` condition at **L134** (same pattern).
4. Run lint and confirm zero new errors.
5. Commit:
   ```
   fix(guidelines): extract isNonExtensibleObject helper in api-namespace
   ```
