# Task 39b: Extract magic strings to constants in boot and context-menu-handler

Status: completed

## Instructions
1. Run lint to identify duplicate string warnings in `src/background/boot.ts` and `src/background/context-menu-handler.ts`.
2. Extract duplicate string literals into module-level constant variables or Enums.
3. Replace all inline duplicate literals with the constants.
4. Verify changes compile and lint passes.
