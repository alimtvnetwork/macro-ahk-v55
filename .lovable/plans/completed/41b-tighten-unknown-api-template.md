# Task 41b: Tighten unknown parameter in api-namespace.ts and template-renderer.ts

Status: completed

## Instructions
1. Open `standalone-scripts/macro-controller/src/api-namespace.ts`. Find `isNonExtensibleObject(value: unknown)`.
2. Change the type of `value` to `object`.
3. Open `standalone-scripts/macro-controller/src/ui/template-renderer.ts`. Find `isTruthy(value: unknown)`.
4. Change the type of `value` to `string | number | boolean | null | undefined`.
5. Verify changes with `tsc`.
