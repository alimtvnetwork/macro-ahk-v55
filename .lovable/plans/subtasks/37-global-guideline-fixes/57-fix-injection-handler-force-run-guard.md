# 57 – Extract isCacheEligible() for Force Run Condition in injection-handler

## Target
`src/background/handlers/injection-handler.ts`

## Rule
**Rule 3** – Avoid double negation in compound conditions; prefer named booleans.

## Violation

| Location | Code |
|----------|------|
| L164 | `if (!isForceRun && !hasInlineSyntaxError)` |

Double negation compound: two `!` prefixes make the condition hard to read at a glance.

## Fix

Extract to a named boolean immediately before the `if`:

```ts
const isCacheEligible = !isForceRun && !hasInlineSyntaxError;
if (isCacheEligible) {
```

The name `isCacheEligible` explains *why* both conditions are checked rather than leaving the reader to mentally invert the two negations.

## Instructions

1. Locate L164 in `injection-handler.ts`.
2. Add `const isCacheEligible = !isForceRun && !hasInlineSyntaxError;` immediately before the `if`.
3. Replace the inline condition with `if (isCacheEligible)`.
4. Run lint and confirm zero new errors.
5. Commit:
   ```
   fix(guidelines): extract isCacheEligible in injection-handler
   ```
