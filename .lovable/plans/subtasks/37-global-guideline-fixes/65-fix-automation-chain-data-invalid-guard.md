# 65 – Extract isChainDataInvalid Compound Guard in automation-chain-handler

## Title
Extract `isChainDataInvalid` compound guard in `automation-chain-handler`

## Target File
`src/background/handlers/automation-chain-handler.ts`

## Rule
**Rule 3 – Semantic Inverse Naming**
Triple (or higher) compound negations in `if` conditions must be extracted into a single, descriptively named boolean variable.

## Violation
| Location | Offending Code |
|----------|---------------|
| L172 | Triple negation compound expression (e.g. `if (!chain \|\| !chain.name \|\| !chain.slug)`) |

Using three consecutive negations inline makes the guard's intent opaque.

## Fix

```ts
// Before
if (!chain || !chain.name || !chain.slug) {

// After
const isChainDataInvalid = !chain || !chain.name || !chain.slug;
if (isChainDataInvalid) {
```

## Instructions
1. Open `src/background/handlers/automation-chain-handler.ts`.
2. Locate L172 with the triple-negation compound guard.
3. Insert `const isChainDataInvalid = ...;` immediately before the `if`, then replace the condition.
4. Run `npm run lint`. Resolve any issues.
5. Verify no logic change.
6. Commit with message:
   ```
   fix(guidelines): extract isChainDataInvalid guard in automation-chain-handler
   ```

## Notes
- If the exact expression at L172 differs slightly from the example above, preserve the actual expression in the extracted variable — do not alter the logic.
- Variable name `isChainDataInvalid` is canonical.
