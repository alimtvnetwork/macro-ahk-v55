# 58 – Extract isCacheStale() for Mixed Polarity in injection-handler

## Target
`src/background/handlers/injection-handler.ts`

## Rule
**Rule 3** – No mixing of positive and negative operands in the same condition.

## Violation

| Location | Code |
|----------|------|
| L182 | `if (cachedPayload && !cacheMatchesRequest)` |

Mixed polarity: a positive truthy check (`cachedPayload`) combined with a negated boolean (`!cacheMatchesRequest`) in the same condition.

## Fix

Extract to a named boolean immediately before the `if`:

```ts
const isCacheStale = cachedPayload !== null && !cacheMatchesRequest;
if (isCacheStale) {
```

> **Note:** `cachedPayload !== null` replaces the loose-truthy `cachedPayload &&` for precision. The name `isCacheStale` encapsulates both semantics (a cache payload exists *and* it no longer matches the current request).

## Instructions

1. Locate L182 in `injection-handler.ts`.
2. Add `const isCacheStale = cachedPayload !== null && !cacheMatchesRequest;` immediately before the `if`.
3. Replace the inline condition with `if (isCacheStale)`.
4. Run lint and confirm zero new errors.
5. Commit:
   ```
   fix(guidelines): extract isCacheStale guard in injection-handler
   ```
