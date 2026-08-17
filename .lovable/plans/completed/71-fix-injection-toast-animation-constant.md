# 71 – Replace Magic Number 350 with ANIMATION_DURATION_MS in injection-toast

## Title
Replace magic number `350` with `ANIMATION_DURATION_MS` constant in `injection-toast`

## Target File
`src/background/handlers/injection-toast.ts`

## Rule
**Rule 8 – No Magic Numbers**
Numeric literals whose meaning is not immediately obvious from context must be extracted into a named constant.

## Violation
The literal value `350` appears multiple times in `injection-toast.ts` as an animation duration (originally derived from `Timings.ANIMATION_DURATION`). There is no comment or constant name explaining what `350` represents.

## Fix
At the top of the file, after existing imports but before any function/class declarations, add:

```ts
const ANIMATION_DURATION_MS = 350;
```

Then replace **every** occurrence of the bare literal `350` with `ANIMATION_DURATION_MS`.

```ts
// Before
setTimeout(callback, 350);

// After
setTimeout(callback, ANIMATION_DURATION_MS);
```

## Instructions
1. Open `src/background/handlers/injection-toast.ts`.
2. Use global search (`350`) to locate all occurrences of the literal `350`.
3. Add `const ANIMATION_DURATION_MS = 350;` near the top of the file (after imports).
4. Replace each literal `350` with `ANIMATION_DURATION_MS`.
5. Run `npm run lint`. Resolve any issues.
6. Confirm no logic change — this is a pure rename of a literal to a named constant.
7. Commit with message:
   ```
   fix(guidelines): replace magic 350 with ANIMATION_DURATION_MS in injection-toast
   ```

## Notes
- If `350` appears in a context unrelated to animation duration (e.g. a pixel size), do **not** replace it with `ANIMATION_DURATION_MS`; extract a separate, appropriately named constant instead.
- See subtask 72 for the companion fix replacing `15000` with `TOAST_TIMEOUT_MS`.
