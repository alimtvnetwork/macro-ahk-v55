# 72 – Replace Magic Number 15000 with TOAST_TIMEOUT_MS in injection-toast

## Title
Replace magic number `15000` with `TOAST_TIMEOUT_MS` constant in `injection-toast`

## Target File
`src/background/handlers/injection-toast.ts`

## Rule
**Rule 8 – No Magic Numbers**
Numeric literals with non-obvious domain meaning must be extracted into named constants.

## Violation
The literal `15000` is used as a toast timeout duration (originally `Timings.TIMEOUT_VERY_LONG`). Its meaning is opaque without the original enum reference.

## Fix
At the top of the file (alongside `ANIMATION_DURATION_MS` added in subtask 71), add:

```ts
const TOAST_TIMEOUT_MS = 15000;
```

Then replace every occurrence of the bare literal `15000` with `TOAST_TIMEOUT_MS`:

```ts
// Before
setTimeout(dismissToast, 15000);

// After
setTimeout(dismissToast, TOAST_TIMEOUT_MS);
```

## Instructions
1. Open `src/background/handlers/injection-toast.ts`.
2. Search globally for `15000`.
3. Add `const TOAST_TIMEOUT_MS = 15000;` near the top of the file (after imports, near `ANIMATION_DURATION_MS`).
4. Replace each literal `15000` with `TOAST_TIMEOUT_MS`.
5. Run `npm run lint`. Resolve any issues.
6. Confirm no logic change.
7. Commit with message:
   ```
   fix(guidelines): replace magic 15000 with TOAST_TIMEOUT_MS in injection-toast
   ```

## Notes
- Apply subtask 71 before (or alongside) this subtask so that both constants are added in the same block.
- If `15000` appears in a different context unrelated to toast timeout, extract a separate constant with a context-specific name.
