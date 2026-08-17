# 50 – Extract isReloadShortcut() to Fix Triple && at L67 in startup-global-handlers

## Target
`standalone-scripts/macro-controller/src/startup-global-handlers.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L67 | `if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r')` |

Three `&&` operands (two boolean properties + a string comparison) in a single `if` condition.

## Fix

Create a named helper at the top of the file:

```ts
function isReloadShortcut(event: KeyboardEvent): boolean {
  return (
    event.ctrlKey &&
    event.altKey &&
    event.key.toLowerCase() === 'r'
  );
}
```

Replace the violation site:

```ts
// Before
if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r')

// After
if (isReloadShortcut(e))
```

The helper name makes the keyboard shortcut semantics clear at the call site.

## Instructions

1. Add the `isReloadShortcut` helper after the import block in `startup-global-handlers.ts`.
2. Replace the triple-`&&` condition at L67 with `if (isReloadShortcut(e))`.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isReloadShortcut guard in startup-global-handlers
   ```
