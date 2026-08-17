# 62 – Rename !hasSessionCookie to isSessionCookieMissing in config-auth-handler

## Title
Extract session-cookie guard variables in `config-auth-handler`

## Target File
`src/background/handlers/config-auth-handler.ts`

## Rule
**Rule 3 – Semantic Inverse Naming**
Compound negative expressions inside `if` conditions must be broken out into individually named boolean variables with positive-inverse names.

## Violation
| Location | Offending Code |
|----------|---------------|
| L726 | `if (!hasSessionCookie \|\| !projectId)` |

The compound guard negates two different concerns in a single expression, making the intent harder to read.

## Fix

```ts
// Before
if (!hasSessionCookie || !projectId) {

// After
const isSessionCookieMissing = !hasSessionCookie;
const isProjectIdAbsent = !projectId;
const isContextInvalid = isSessionCookieMissing || isProjectIdAbsent;
if (isContextInvalid) {
```

## Instructions
1. Open `src/background/handlers/config-auth-handler.ts`.
2. Locate L726 containing `if (!hasSessionCookie || !projectId)`.
3. Insert the three extracted variable declarations immediately above the `if` statement, then replace the condition with `isContextInvalid`.
4. Run `npm run lint`. Fix any lint errors.
5. Confirm no logic change (pure extraction).
6. Commit with message:
   ```
   fix(guidelines): extract session cookie guard in config-auth-handler
   ```

## Notes
- Keep the extracted variables in the same lexical scope as the original `if`.
- The three variable names (`isSessionCookieMissing`, `isProjectIdAbsent`, `isContextInvalid`) are canonical — do not abbreviate or rename them.
