# SS-01 — Parallel /credit-balance fan-out for all enriched workspaces

Slug: fanout
Status: completed
Created: 2026-07-05
Parent: 10-unified-billing-all-workspaces

## Detail

Current fetcher enriches at most one workspace (the `pro_0` path). Change to:

```ts
const targets = workspaces.filter(needsBalanceEnrichment);
const results = await Promise.allSettled(
  targets.map((ws) => fetchCreditBalance(ws.id, bearer))
);
```

Rules:
- Never `Promise.all` — one failed workspace must not blank the whole panel.
- Reuse the existing per-workspace cache key `credit-balance:${ws.id}` with the current TTL; no new cache layer.
- Log rejections through `RiseupAsiaMacroExt.Logger.error('CreditBalance.fetch', caught, { workspaceId })` — no swallow.
- Concurrency cap: 6 in-flight requests (`p-limit`-style manual gate) to stay under the Lovable API's implicit rate limit on accounts with 20+ workspaces.
- Fail-fast per request (no retry, no backoff) per `mem://constraints/no-retry-policy`.

## Verification

- Unit test: mock 8 workspaces (5 enriched, 3 legacy) → exactly 5 fetches issued, results map keyed by workspace id.
- Unit test: one rejected fetch → other 4 still populate; failed workspace falls back to list-endpoint values with a warn log.
