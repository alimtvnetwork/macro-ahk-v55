# Unified-billing credit enrichment for ALL workspaces

Slug: unified-billing-all-workspaces
Steps: 10
Status: pending
Created: 2026-07-05

## Context

Extend the existing `pro_0` `/workspaces/{id}/credit-balance` enrichment so it fires for **every** workspace whose data cannot be trusted from the `/user/workspaces` list endpoint (unified-billing migrated plans like `ktlo_2`, plus any future migrated plan). Today only a single workspace path (`pro_0`) is enriched; all others read stale `billing_period_credits_*` fields from the list endpoint and show wrong totals.

Files involved:
- `standalone-scripts/macro-controller/src/credits/credit-balance-parser.ts` (trigger)
- `standalone-scripts/macro-controller/src/credits/credit-balance-fetcher.ts` (parallel fan-out)
- `standalone-scripts/macro-controller/src/credits/credit-balance-mapper.ts` (field mapping)
- `standalone-scripts/macro-controller/src/types/credit-types.ts` (new sub-bucket fields)
- Tests: `tests/e2e/fixtures/credit-balance/workspaces.ts`, `tests/e2e/utils/credit-balance-stub.ts`, unit tests under `standalone-scripts/macro-controller/src/credits/__tests__/`
- Memory: `mem://features/macro-controller/pro-zero-credit-balance` → rename to `credit-balance-enrichment`

Related:
- Prior fix scope: `mem://features/macro-controller/pro-zero-credit-balance`
- API contract: `spec/21-app/01-chrome-extension/credit-balance-update/05-api-contract.md`
- Trigger logic: `spec/21-app/01-chrome-extension/credit-balance-update/02-trigger-logic.md`

## Steps

1. Add `needsBalanceEnrichment(ws)` helper in `credit-balance-parser.ts` returning true when `plan === 'pro_0'` OR `ws.experimental_features?.unified_billing === true` OR `plan` matches `/^ktlo_/`. Export for reuse.
2. Update `WireWorkspace` type (list-endpoint shape) to include optional `experimental_features?: { unified_billing?: boolean }` and `plan_type`.
3. ✅ Change the fetcher fan-out to iterate ALL workspaces where `needsBalanceEnrichment` is true and issue `/credit-balance` in parallel with `Promise.allSettled` (fail-fast per workspace, never blocks siblings). See `./subtasks/10-unified-billing-all-workspaces/01-fanout.md`.
4. Extend the `/credit-balance` response mapper: map `total_granted → totalCredits`, `total_remaining → available`, `total_billing_period_used → totalCreditsUsed`, `daily_limit/daily_remaining → dailyLimit/dailyFree`, `cloud_remaining`, `ai_remaining`, and preserve `grant_type_balances[]` on `WorkspaceCredit`.
5. In `parseApiResponse`, bypass the legacy `calcTotalCredits`/`calcAvailableCredits` formula for any enriched workspace — the enrichment payload is authoritative. Guard with `if (enriched) { … } else { legacy math }`.
6. Add tests: extend `tests/e2e/fixtures/credit-balance/workspaces.ts` with `KTLO_2_UNIFIED_WORKSPACE` (real payload from user paste) and a corresponding `KTLO_2_CREDIT_BALANCE`; add unit test asserting `needsBalanceEnrichment` is true for `ktlo_2` and for `experimental_features.unified_billing === true`.
7. Add E2E spec `tests/e2e/e2e-credit-balance-unified-billing.spec.ts` verifying: multi-workspace fan-out fires one `/credit-balance` per unified workspace, totals reflect `total_granted`, and non-unified workspaces do NOT trigger a fetch.
8. Update `mem://features/macro-controller/pro-zero-credit-balance` → rename memory to `credit-balance-enrichment` and rewrite trigger rule; update `mem://index.md` reference.
9. Bump patch version (manifest.json + constants.ts + version.json) and add CHANGELOG entry `credit: enrich every unified-billing workspace (ktlo_*, unified_billing flag), not just pro_0`.
10. Manual verification: load extension, open workspace switcher on an account containing at least one `ktlo_2` workspace and one legacy pro workspace, confirm Credit Totals for BOTH match `/credit-balance` numbers (302.9 / 315 for the pasted sample), and confirm legacy workspaces still render without an extra fetch.

## Verification

- `pnpm test` (unit) — new `needsBalanceEnrichment` test green.
- `pnpm test:e2e -- e2e-credit-balance-unified-billing` green.
- Preview build: manifest/constants/version.json versions match (`scripts/__tests__/unified-version-sites.test.mjs`).
- Manual DevTools Network tab: exactly one `/credit-balance` call per unified workspace; zero calls for non-unified.
- Credit Totals popup for the pasted `L01 Jun 26` workspace shows Total=315, Available=302.9, Used=11.5.

## Appended from prior pending tasks

none — all `.lovable/plans/pending/` slots were previously empty; `.lovable/issues/01-task-next-queue-sequential.md` is already tracked in `completed/01-*`.
