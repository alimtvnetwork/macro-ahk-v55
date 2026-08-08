import { logError } from '../error-utils';
import { PlanTierType } from './plan';

const LOG_SCOPE = 'CreditBalanceUpdate.plan';

export function mapPlanFromWire(wirePlan: string | null | undefined): PlanTierType {
    const normalized = (wirePlan || '').trim().toLowerCase();

    const isMissingNormalized = !normalized;

    if (isMissingNormalized) {
        return PlanTierType.Unknown;
    }

    // `ktlo`, `lite`, `ktlo_2`, `ktlo_3`, … all collapse to PlanTierType.Ktlo
    // (Lovable ships Lite tiers as `ktlo_<N>` on the wire — see workspace
    // payload `plan: "ktlo_2"`). Match prefix before exact-case switch.
    if (normalized === 'lite' || normalized === 'ktlo' || normalized.startsWith('ktlo_')) {
        return PlanTierType.Ktlo;
    }

    switch (normalized) {
        case 'pro_0':
            return PlanTierType.Pro0;
        case 'pro_1':
            return PlanTierType.Pro1;
        case 'pro_3':
            return PlanTierType.Pro3;
        case 'free':
            return PlanTierType.Free;
        case 'cancelled':
        case 'canceled':
            return PlanTierType.Cancelled;
        case 'business':
            return PlanTierType.Business;
        case 'enterprise':
            return PlanTierType.Enterprise;
        default:
            logError(
                LOG_SCOPE,
                '[CODE RED] Unknown workspace plan. Path: standalone-scripts/macro-controller/src/credit-balance-update/plan-mapper.ts. Missing item: PlanTierType enum mapping for wire plan "' + normalized + '". Reason: unknown plan cannot safely trigger /credit-balance; falling back to inline fields.',
            );

            return PlanTierType.Unknown;
    }
}

export function shouldFetchCreditBalanceForPlan(plan: PlanTierType): boolean {
    return plan === PlanTierType.Ktlo || plan === PlanTierType.Free || plan === PlanTierType.Cancelled || plan === PlanTierType.Pro0;
}

/**
 * Human-readable label for a wire plan string. Used by the workspace badge,
 * Credit Totals modal, hover-card, and CSV export so the same plan never
 * renders inconsistent text across surfaces.
 *
 * Examples:
 *   `ktlo_2`   → `Light 2`
 *   `ktlo`     → `Lite`
 *   `lite`     → `Lite`
 *   `pro_0`    → `Pro 0`
 *   `pro_3`    → `Pro 3`
 *   `business` → `Business`
 *   ``         → `` (caller decides fallback, e.g. `—`)
 */
export function formatPlanDisplayLabel(wirePlan: string | null | undefined): string {
    const normalized = (wirePlan || '').trim().toLowerCase();
    const isMissingNormalized = !normalized;
    if (isMissingNormalized) return '';

    const ktloTier = /^ktlo_(\d+)$/.exec(normalized);
    if (ktloTier) return 'Light ' + ktloTier[1];
    if (normalized === 'ktlo' || normalized === 'lite') return 'Lite';

    const proTier = /^pro_(\d+)$/.exec(normalized);
    if (proTier) return 'Pro ' + proTier[1];

    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
    if (normalized === 'free') return 'Free';
    if (normalized === 'business') return 'Business';
    if (normalized === 'enterprise') return 'Enterprise';

    // Unknown — surface the raw token verbatim so support can spot new tiers.
    return normalized;
}

