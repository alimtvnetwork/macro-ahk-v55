# 49 – Extract isInvalidThemePreset() to Fix Triple && at L172 in config-validator

## Target
`standalone-scripts/macro-controller/src/config-validator.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L172 | `if (theme.activePreset && theme.activePreset !== 'dark' && theme.activePreset !== 'light')` |

Three `&&` operands (truthy check + two inequality checks) in a single `if` condition.

## Fix

Create a named helper at the top of the file:

```ts
function isInvalidThemePreset(preset: unknown): boolean {
  return (
    !!preset &&
    preset !== 'dark' &&
    preset !== 'light'
  );
}
```

Replace the violation site:

```ts
// Before
if (theme.activePreset && theme.activePreset !== 'dark' && theme.activePreset !== 'light')

// After
if (isInvalidThemePreset(theme.activePreset))
```

The helper name makes the intent (detecting an unrecognised preset) self-documenting.

## Instructions

1. Add the `isInvalidThemePreset` helper after the import block in `config-validator.ts`.
2. Replace the triple-`&&` condition at L172 with `if (isInvalidThemePreset(theme.activePreset))`.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isInvalidThemePreset in config-validator
   ```
