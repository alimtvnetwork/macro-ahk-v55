# Task 42a: Move theme and auth validation helpers to dedicated files

Status: completed

## Instructions
1. Move `isInvalidThemePreset(preset)` from `config-validator.ts` to `standalone-scripts/macro-controller/src/types/theme-types.ts` (create it if missing, end with Enum/Type conventions).
2. Create `standalone-scripts/macro-controller/src/auth-utils.ts` (or use `auth-resolve.ts` if it exists). Export a single `isAuthFailure(status: number): boolean` helper.
3. Replace all 6 duplicate inline definitions of `isAuthFailure` in:
   - `credit-balance.ts:94`
   - `credit-fetch.ts:103`
   - `loop-cycle-fallback.ts:56`
   - `workspace-detection.ts:29`
   - `ws-adjacent.ts:33`
   - `ws-move.ts:37`
   with the single imported version.
4. Verify changes compile.
