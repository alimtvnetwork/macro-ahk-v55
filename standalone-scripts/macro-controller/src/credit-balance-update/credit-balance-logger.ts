import { logError, logWarn } from '../error-utils';
import type { CreditFailureLogPayload } from './credit-balance-types';

const LOG_SCOPE_FETCH = 'CreditBalanceUpdate.fetch';
const LOG_SCOPE_PARSE = 'CreditBalanceUpdate.parse';

function payloadToMessage(payload: CreditFailureLogPayload): string {
    return JSON.stringify(payload);
}

export function sanitizeBearerPrefix(token: string | null): string | null {
    if (!token) {
        return null;
    }
    return token.substring(0, 12) + '…REDACTED';
}

export function logCreditFetchFailure(payload: CreditFailureLogPayload, caught?: CaughtError): void {
    logError(LOG_SCOPE_FETCH, payloadToMessage(payload), caught);
}

export function logCreditParseFailure(payload: CreditFailureLogPayload, caught?: CaughtError): void {
    logError(LOG_SCOPE_PARSE, payloadToMessage(payload), caught);
}

export function logCreditParseWarning(reasonDetail: string): void {
    logWarn(LOG_SCOPE_PARSE, reasonDetail);
}
