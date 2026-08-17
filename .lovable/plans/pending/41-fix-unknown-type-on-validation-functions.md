# Task 41: Fix `unknown` Type on Validation/Guard Functions

## Problem
Several functions use `unknown` as a parameter type when the function only performs string-level checks (`.startsWith()`, `!==`, `typeof === 'string'`). These functions should use a more precise type like `string | undefined` or `string | null`. Using `unknown` forces unnecessary type narrowing boilerplate and hides the true intent of the function.

> **Rule**: If a function only checks string properties, the parameter should be typed `string | undefined` (or `string | null`). Reserve `unknown` for true schema/runtime validation entry points (like `validateConfig(raw: unknown)`).

---

## Files to Fix

### `standalone-scripts/macro-controller/src/config-validator.ts` (L15)
```ts
// BEFORE — too broad
function isInvalidThemePreset(preset: unknown): boolean {
  return !!preset && preset !== 'dark' && preset !== 'light';
}

// AFTER — precise type, no double-negation
function isInvalidThemePreset(preset: string | undefined): boolean {
  const isPresetSet = preset !== undefined && preset !== '';
  const isNotDark = preset !== 'dark';
  const isNotLight = preset !== 'light';
  return isPresetSet && isNotDark && isNotLight;
}
```
Also move this function to `standalone-scripts/macro-controller/src/types/theme-types.ts` (create if missing) — see Task 42.

### `standalone-scripts/macro-controller/src/settings-store.ts` (L104)
```ts
// BEFORE
function isFiniteNonNegative(n: unknown): n is number {

// AFTER
function isFiniteNonNegative(n: number | undefined | null): n is number {
```

### `standalone-scripts/macro-controller/src/api-namespace.ts` (L54)
```ts
// BEFORE
function isNonExtensibleObject(value: unknown): boolean {

// AFTER — the caller always passes an object
function isNonExtensibleObject(value: object): boolean {
```

### `standalone-scripts/macro-controller/src/ui/template-renderer.ts` (L172)
```ts
// BEFORE
function isTruthy(value: unknown): boolean {

// AFTER — this is a template-value guard, be explicit
function isTruthy(value: string | number | boolean | null | undefined): boolean {
```

### `standalone-scripts/macro-controller/src/ui/read-memory-admin-modal.ts` (L25)
```ts
// BEFORE
function isReadMemoryRow(value: unknown): value is ReadMemoryRow {

// AFTER — this is a JSON parse guard, keep unknown only if coming from JSON.parse
// If the caller passes typed data, tighten the type accordingly.
```
Inspect the caller. If input comes directly from `JSON.parse`, `unknown` is correct — skip this one. Otherwise narrow it.

---

## Instructions for AI Fixer
1. For each file above, open the file, find the function signature, and tighten the `unknown` parameter to the most specific type that satisfies all callers.
2. Verify that all callers still compile (no TypeScript errors).
3. Do NOT change the function body logic — only the parameter type.
4. Run `pnpm run lint` and fix any new warnings.
5. Commit: `refactor(types): tighten unknown param types on guard functions`
