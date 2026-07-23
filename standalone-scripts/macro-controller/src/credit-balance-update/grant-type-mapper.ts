import { logError } from '../error-utils';
import { GrantType } from './grant-type';

const LOG_SCOPE = 'CreditBalanceUpdate.grantType';

export function mapGrantTypeFromWire(wireGrantType: string | null | undefined): GrantType {
    const normalized = (wireGrantType || '').trim().toLowerCase();

    if (!normalized) {
        return GrantType.Unknown;
    }

    switch (normalized) {
        case 'daily':
            return GrantType.Daily;
        case 'billing':
        case 'billing_period':
        case 'monthly':
            return GrantType.Billing;
        case 'granted':
        case 'free':
            return GrantType.Granted;
        case 'topup':
        case 'top_up':
            return GrantType.Topup;
        case 'bonus':
        case 'promotional':
            return GrantType.Bonus;
        case 'rollover':
            return GrantType.Rollover;
        default:
            logError(
                LOG_SCOPE,
                '[CODE RED] Unknown credit grant type. Path: standalone-scripts/macro-controller/src/credit-balance-update/grant-type-mapper.ts. Missing item: GrantType enum mapping for wire grant_type "' + normalized + '". Reason: preserving row as GrantType.Unknown so totals continue without unsafe assumptions.',
            );
            return GrantType.Unknown;
    }
}
