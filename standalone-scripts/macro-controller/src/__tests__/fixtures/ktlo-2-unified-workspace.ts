/**
 * KTLO_2 unified-billing fixtures — captured verbatim from live DevTools
 * inspection (2026-07-05, workspace_01kq8ab6n4eyct5z482cyh6084 "L01 Jun 26").
 *
 * Two payloads:
 *   1. `KTLO_2_UNIFIED_WORKSPACE_WIRE` — the `/user/workspaces` row shape
 *      after unified billing migration. `billing_period_credits_limit: 20`
 *      is the CLOUD sub-bucket only; the authoritative totals live on
 *      `/credit-balance`.
 *   2. `KTLO_2_CREDIT_BALANCE_WIRE` — the `/credit-balance` response for
 *      the same workspace: total_granted 310 + daily 5 → 315 total.
 *
 * These are the regression anchors for the ktlo_2 wrong-total bug.
 */

export const KTLO_2_UNIFIED_WORKSPACE_WIRE = {
    id: 'workspace_01kq8ab6n4eyct5z482cyh6084',
    name: 'L01 Jun 26',
    owner_id: 'WFj68cicC8VkToK7np9jddqYenz2',
    created_at: '2026-04-27T20:33:27.247054Z',
    updated_at: '2026-07-01T13:27:45.982Z',
    migrated_to_unified_billing_at: '2026-06-19T11:27:20.468Z',
    plan: 'ktlo_2',
    plan_type: 'monthly',
    billing_period_credits_used: 12.1,
    billing_period_credits_limit: 20,
    daily_credits_used: 0,
    daily_credits_limit: 5,
    num_projects: 3,
    experimental_features: { unified_billing: true, gitsync_github: false },
    grant_type_balances: [
        { grant_type: 'daily', granted: 5, remaining: 5 },
        { grant_type: 'granted', granted: 310, remaining: 297.9 },
    ],
} as const;

export const KTLO_2_CREDIT_BALANCE_WIRE = {
    ledger_enabled: false,
    total_remaining: 297.9,
    total_granted: 310,
    daily_remaining: 5,
    daily_limit: 5,
    total_billing_period_used: 12.1,
    expiring_grants: [
        { grant_type: 'granted', remaining: 297.9, expires_at: '2027-06-21T07:13:36.339349303Z' },
    ],
    grant_type_balances: [
        { grant_type: 'daily', granted: 5, remaining: 5 },
        { grant_type: 'granted', granted: 310, remaining: 297.9 },
    ],
} as const;

/** Expected authoritative display totals after overlay + resolveDisplay*. */
export const KTLO_2_EXPECTED_DISPLAY = {
    total: 315, // sumGranted(5+310) wins over totalGranted(310) and dailyLimit(5)
    available: 303, // sumRemaining(round(5)+round(297.9)=303) wins over 298 and 5
    totalUsed: 12,
} as const;
