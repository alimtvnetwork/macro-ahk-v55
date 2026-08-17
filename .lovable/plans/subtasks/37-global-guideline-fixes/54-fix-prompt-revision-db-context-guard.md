# 54 – Extract isContextWithSlug() in prompt-revision-db

## Target
`standalone-scripts/macro-controller/src/db/prompt-revision-db.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L64 | `if (context && typeof context === 'object' && 'slug' in context)` |

Three `&&` operands (truthy check + type check + property existence check) in a single `if` condition.

## Fix

Create a type-predicate helper at the top of the file:

```ts
function isContextWithSlug(value: unknown): value is { slug: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'slug' in (value as object)
  );
}
```

Replace the violation site:

```ts
// Before
if (context && typeof context === 'object' && 'slug' in context)

// After
if (isContextWithSlug(context))
```

The type predicate narrows `context` to `{ slug: string }` inside the `if` block, removing any downstream casts.

## Instructions

1. Add the `isContextWithSlug` helper after the import block in `prompt-revision-db.ts`.
2. Replace the triple-`&&` condition at L64 with `if (isContextWithSlug(context))`.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isContextWithSlug guard in prompt-revision-db
   ```
