# 16 — Test Plan (Unit / Function)

Vitest, colocated under `__tests__/`.

## `plan-mapper.test.ts`
- `pro_0`, `pro_1`, `ktlo`, `free`, `cancelled`, `business`, `enterprise` map
  to expected enums.
- `""`, `null`, `undefined`, `"bogus"` → `Plan.Unknown` and Logger.warn called.

## `grant-type-mapper.test.ts`
- All known wire strings round-trip.
- Unknown wire string → `GrantType.Unknown` + warn.

## `credit-balance-parser.test.ts`
- Parses the sample response verbatim.
- Missing numeric fields default to 0 (warns).
- Bad shape → throws `ParseError`.

## `credit-fetch-controller.test.ts`
- Inline credits present → no fetch, outcome `InlineHit`.
- Plan = Pro1 → no fetch, outcome `Skipped`.
- Plan = Ktlo, no inline credits, fetch succeeds → `ApiHit`, cache populated.
- Plan = Free, cache fresh → `ApiCacheHit`, no fetch.
- Plan = Cancelled, fetch exceeds timeout → `Timeout`, last cached returned.
- 401 → force-refresh token, retry once, then `AuthError` on second 401.
- Single-flight: 5 concurrent `fetchOnce(id)` calls share one HTTP request.

## `credit-balance-cache.test.ts`
- TTL boundary: 9:59 → hit, 10:01 → miss.
- Settings change invalidates cache.

## `credit-summary-resolver.test.ts`
- `total = totalGranted` when `totalGranted > 0`.
- Falls back to `dailyLimit` for pure-Free workspaces (`totalGranted = 0`).
- `—` rendered when balance is null AND no cached value.
