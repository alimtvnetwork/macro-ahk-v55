# 45 – Extract isRawFieldsComplete() to Fix Triple && at L199 in injection-request-resolver

## Target
`src/background/handlers/injection-request-resolver.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition; avoid mixing positive and negative operands.

## Violation

| Location | Code |
|----------|------|
| L199 | `if (fields.rawPath !== null && fields.rawOrder !== null && !fields.hasCodeKey)` |

Three `&&` operands with mixed polarity (two positive null-checks + one negation).

## Fix

Decompose into two named booleans before the `if`:

```ts
const isRawFieldsComplete = fields.rawPath !== null && fields.rawOrder !== null;
const isCodeKeyAbsent = !fields.hasCodeKey;
const isResolvedByRaw = isRawFieldsComplete && isCodeKeyAbsent;
if (isResolvedByRaw) {
```

Each intermediate variable holds at most 2 `&&` operands, and polarity is now uniform within each expression.

## Instructions

1. Locate L199 in `injection-request-resolver.ts`.
2. Replace the single `if` statement with the three named booleans shown above.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isRawFieldsComplete guard in injection-request-resolver
   ```
