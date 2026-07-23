/**
 * Credit Balance E2E fixtures (Phase B Step 52).
 *
 * Real-shape Ktlo / Free / Cancelled / Inline-Pro workspace payloads matching
 * the `/user/workspaces` and `/workspaces/{id}/credit-balance` contracts in
 * `spec/21-app/01-chrome-extension/credit-balance-update/05-api-contract.md`.
 *
 * These power the four previously-fixme specs:
 *   - e2e-credit-balance-ktlo.spec.ts
 *   - e2e-credit-balance-timeout.spec.ts
 *   - e2e-credit-balance-no-fetch-when-inline.spec.ts
 *   - e2e-credit-totals-modal.spec.ts
 *
 * Fixtures intentionally use snake_case wire keys — the
 * `credit-balance-parser.ts` maps them to camelCase enum forms.
 */

export interface WireWorkspace {
    id: string;
    name: string;
    owner_id: string;
    plan: string;
    default_project_visibility: string;
    billing_period_credits_used: number;
    billing_period_credits_limit: number;
    is_personal: boolean;
    num_projects: number;
    membership: {
        workspace_id: string;
        user_id: string;
        role: string;
        email: string;
        monthly_credit_limit: number | null;
        invited_at: string;
        joined_at: string;
    };
    grant_type_balances: Array<{ grant_type: string; granted: number; remaining: number }>;
    subscription_status?: string;
}

export interface WireCreditBalance {
    $schema?: string;
    total_remaining: number;
    total_granted: number;
    daily_remaining: number;
    daily_limit: number;
    total_billing_period_used: number;
    expiring_grants: Array<{ grant_type: string; remaining: number; expires_at: string }>;
    grant_type_balances: Array<{ grant_type: string; granted: number; remaining: number }>;
}

const MEMBERSHIP_BASE = {
    user_id: 'usr-fixture-001',
    role: 'owner',
    email: 'fixture@lovable.test',
    monthly_credit_limit: null,
    invited_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z',
} as const;

/** Lite/Ktlo workspace — no inline credits (triggers /credit-balance fetch). */
export const KTLO_WORKSPACE: WireWorkspace = {
    id: 'ws-ktlo-001',
    name: 'Ktlo Lite Workspace',
    owner_id: 'usr-fixture-001',
    plan: 'ktlo',
    default_project_visibility: 'private',
    billing_period_credits_used: 0,
    billing_period_credits_limit: 0,
    is_personal: false,
    num_projects: 2,
    membership: { ...MEMBERSHIP_BASE, workspace_id: 'ws-ktlo-001' },
    grant_type_balances: [],
};

/** Free workspace — no inline credits (triggers /credit-balance fetch). */
export const FREE_WORKSPACE: WireWorkspace = {
    id: 'ws-free-001',
    name: 'Free Workspace',
    owner_id: 'usr-fixture-001',
    plan: 'free',
    default_project_visibility: 'private',
    billing_period_credits_used: 0,
    billing_period_credits_limit: 0,
    is_personal: true,
    num_projects: 1,
    membership: { ...MEMBERSHIP_BASE, workspace_id: 'ws-free-001' },
    grant_type_balances: [],
};

/** Cancelled subscription workspace — no inline credits. */
export const CANCELLED_WORKSPACE: WireWorkspace = {
    id: 'ws-cancelled-001',
    name: 'Cancelled Pro Workspace',
    owner_id: 'usr-fixture-001',
    plan: 'pro_1',
    default_project_visibility: 'private',
    billing_period_credits_used: 0,
    billing_period_credits_limit: 0,
    is_personal: false,
    num_projects: 3,
    membership: { ...MEMBERSHIP_BASE, workspace_id: 'ws-cancelled-001' },
    grant_type_balances: [],
    subscription_status: 'canceled',
};

/** Pro workspace WITH inline credits — must NOT trigger /credit-balance fetch. */
export const INLINE_PRO_WORKSPACE: WireWorkspace = {
    id: 'ws-pro-inline-001',
    name: 'Pro Workspace (inline credits)',
    owner_id: 'usr-fixture-001',
    plan: 'pro_1',
    default_project_visibility: 'private',
    billing_period_credits_used: 12,
    billing_period_credits_limit: 100,
    is_personal: false,
    num_projects: 5,
    membership: { ...MEMBERSHIP_BASE, workspace_id: 'ws-pro-inline-001', monthly_credit_limit: 100 },
    grant_type_balances: [
        { grant_type: 'monthly', granted: 100, remaining: 88 },
    ],
};

/** Standard /credit-balance success payload for a Ktlo/Free workspace. */
export function makeCreditBalance(opts: {
    totalRemaining?: number;
    totalGranted?: number;
    dailyRemaining?: number;
    dailyLimit?: number;
} = {}): WireCreditBalance {
    const dailyLimit = opts.dailyLimit ?? 5;
    const dailyRemaining = opts.dailyRemaining ?? dailyLimit;
    const totalGranted = opts.totalGranted ?? dailyLimit;
    const totalRemaining = opts.totalRemaining ?? dailyRemaining;
    return {
        total_remaining: totalRemaining,
        total_granted: totalGranted,
        daily_remaining: dailyRemaining,
        daily_limit: dailyLimit,
        total_billing_period_used: totalGranted - totalRemaining,
        expiring_grants: [],
        grant_type_balances: [
            { grant_type: 'daily', granted: dailyLimit, remaining: dailyRemaining },
        ],
    };
}

export const KTLO_CREDIT_BALANCE = makeCreditBalance({ dailyLimit: 5 });
export const FREE_CREDIT_BALANCE = makeCreditBalance({ dailyLimit: 10 });
export const CANCELLED_CREDIT_BALANCE = makeCreditBalance({
    totalRemaining: 0,
    totalGranted: 0,
    dailyRemaining: 0,
    dailyLimit: 0,
});
