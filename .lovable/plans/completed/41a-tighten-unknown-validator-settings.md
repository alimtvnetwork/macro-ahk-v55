# Task 41a: Tighten unknown parameter in config-validator.ts and settings-store.ts

Status: completed

## Instructions
1. Open `standalone-scripts/macro-controller/src/config-validator.ts`. Find `isInvalidThemePreset(preset: unknown)`.
2. Change the type of `preset` to `string | undefined`.
3. Open `standalone-scripts/macro-controller/src/settings-store.ts`. Find `isFiniteNonNegative(n: unknown)`.
4. Change the type of `n` to `number | undefined | null`.
5. Verify changes with `tsc`.
