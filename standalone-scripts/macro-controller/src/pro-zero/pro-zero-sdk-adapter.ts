/**
 * pro-zero-sdk-adapter — thin SDK call wrapper for /credit-balance.
 *
 * Spec: spec/22-app-issues/110-macro-controller-pro-zero-credit-balance.md §5.2
 *
 * Wraps `window.marco.api.credits.fetchBalance(...)` with strict typing and
 * an error-only return shape so the higher-level client can branch cleanly.
 */

import { throwDiagnostic } from '../errors/diagnostic-error';
import { CREDIT_API_BASE } from '../shared-state';

export interface SdkBalanceResponse {
    readonly ok: boolean;
    readonly status: number;
    readonly data: unknown;
}

interface SdkBridge {
    api: { credits: { fetchBalance(wsId: string, opts: { baseUrl: string }): Promise<SdkBalanceResponse> } };
}

function getSdk(stage: string): SdkBridge {
    const sdk = (window as unknown as { marco?: SdkBridge }).marco;
    if (!sdk || !sdk.api || !sdk.api.credits) {
        throwDiagnostic('PROZERO_ADAPTER_E001', { stage });
    }
    return sdk;
}

export async function callFetchBalance(workspaceId: string): Promise<SdkBalanceResponse> {
    const sdk = getSdk('callFetchBalance');

    return sdk.api.credits.fetchBalance(workspaceId, { baseUrl: CREDIT_API_BASE });
}
