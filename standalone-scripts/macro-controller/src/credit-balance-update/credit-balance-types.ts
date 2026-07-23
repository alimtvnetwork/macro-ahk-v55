import type { CreditFetchOutcome } from './credit-fetch-outcome';
import type { GrantType } from './grant-type';
import type { Plan } from './plan';

export interface Membership {
    readonly workspaceId: string;
    readonly userId: string;
    readonly role: string;
    readonly email: string;
    readonly monthlyCreditLimit: number | null;
    readonly invitedAt: string;
    readonly joinedAt: string;
}

export interface WorkspaceInfo {
    readonly id: string;
    readonly name: string;
    readonly ownerId: string;
    readonly plan: Plan;
    readonly defaultProjectVisibility: string;
    readonly billingPeriodCreditsUsed: number;
    readonly billingPeriodCreditsLimit: number;
    readonly isPersonal: boolean;
    readonly numProjects: number;
    readonly membership: Membership;
    readonly grantTypeBalances: ReadonlyArray<GrantTypeBalance>;
}

export interface GrantTypeBalance {
    readonly grantType: GrantType;
    readonly granted: number;
    readonly remaining: number;
}

export interface ExpiringGrant {
    readonly grantType: GrantType;
    /** Credits remaining in this grant. Wire aliases: `remaining` (legacy) or `credits` (2026-06 shape). */
    readonly remaining: number;
    readonly expiresAt: string;
    /** Wire field `applicability` (added 2026-06 with new grant shape). Empty when absent. */
    readonly applicability: string;
}

export interface CreditBalance {
    readonly totalRemaining: number;
    readonly totalGranted: number;
    readonly dailyRemaining: number;
    readonly dailyLimit: number;
    readonly totalBillingPeriodUsed: number;
    /** Wire field `available_balance` (added 2026-06). 0 when absent. */
    readonly availableBalance: number;
    /** Wire field `cloud_remaining` (added 2026-06). 0 when absent. */
    readonly cloudRemaining: number;
    /** Wire field `ai_remaining` (added 2026-06). 0 when absent. */
    readonly aiRemaining: number;
    /**
     * Wire field `ledger_enabled` (unified billing, 2026-07). Indicates the
     * workspace's authoritative source is the credit ledger — downstream
     * code uses this to bypass legacy `calcTotalCredits`/`calcAvailableCredits`
     * formulas that were derived from the list endpoint sub-buckets.
     * Optional to preserve backward compat with existing test fixtures;
     * treat `undefined` as `false`.
     */
    readonly ledgerEnabled?: boolean;
    readonly expiringGrants: ReadonlyArray<ExpiringGrant>;
    readonly grantTypeBalances: ReadonlyArray<GrantTypeBalance>;
}

export interface CreditFetchResult {
    readonly outcome: CreditFetchOutcome;
    readonly balance: CreditBalance | null;
    readonly fetchedAt: number;
    readonly sourceUrl: string;
    readonly errorDetail: string | null;
}

export interface CreditFailureLogPayload {
    readonly Reason: string;
    readonly ReasonDetail: string;
    readonly SourceUrl: string;
    readonly WorkspaceId: string;
    readonly Plan: Plan;
    readonly BearerPrefix: string | null;
    readonly Status: number | null;
    readonly BodyPreview: string | null;
    readonly TimeoutMs: number;
    readonly ElapsedMs: number;
}
