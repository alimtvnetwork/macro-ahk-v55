# Subtask 07: Network Reporter Type Safety

Status: completed

## Goal
Resolve `any` type casting issues in `src/content-scripts/network-reporter.ts`.

## Action Items
1. Open `src/content-scripts/network-reporter.ts`. Locate lines 98, 99, 100.
2. Define a custom `MarcoXhr` interface that extends `XMLHttpRequest` with custom fields `__marco_method`, `__marco_url`, and `__marco_startTime`.
3. Replace the `as any` casts on `this` inside open and send interceptions with `as MarcoXhr`.
4. Verify changes compile cleanly.
