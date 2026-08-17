# 01 - Fix raw negation guards in automation-chain-handler.ts

## Agent Title
Fixing Boolean Guards in automation-chain-handler

## Target File
`src/background/handlers/automation-chain-handler.ts`

## Rule Violated
Rule 3: No raw `!` in if-conditions. Every negative check must use a positively-named boolean variable.

## Violations

### L172
```ts
if (!chain || !chain.name || !chain.slug) {
```
Fix:
```ts
const isChainDataInvalid = !chain || !chain.name || !chain.slug;
if (isChainDataInvalid) {
```

### L221
```ts
if (!chainId) {
```
Fix:
```ts
const isChainIdMissing = !chainId;
if (isChainIdMissing) {
```

### L244 (same pattern as L221)
Use `isChainIdMissing` variable declared at the function scope above.

### L270
```ts
if (!Array.isArray(chains)) {
```
Fix:
```ts
const isChainsArrayMissing = !Array.isArray(chains);
if (isChainsArrayMissing) {
```

## Instructions
1. Read `src/background/handlers/automation-chain-handler.ts` fully.
2. Apply all four fixes in a single edit pass.
3. Run `pnpm run lint` to confirm 0 errors.
4. Commit: `fix(guidelines): extract named boolean guards in automation-chain-handler`
