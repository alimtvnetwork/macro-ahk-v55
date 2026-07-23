// Synthetic 401 regression:
// Locks the contract that a 401 from /credit-balance:
//   1. Marks the bearer token expired with the 'credit-balance-update' scope,
//   2. Emits exactly one logError('CreditBalanceUpdate.fetch', …) call,
//   3. Returns CreditFetchOutcome.AuthError with BearerPrefix redacted,
//   4. Does not swallow the failure into a success outcome.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Plan } from '../plan';
import { CreditFetchOutcome } from '../credit-fetch-outcome';

const { getBearerTokenSpy, markBearerTokenExpiredSpy, logErrorSpy, logWarnSpy } = vi.hoisted(() => ({
    getBearerTokenSpy: vi.fn(async () => 'tok_synthetic_401_regression_0000'),
    markBearerTokenExpiredSpy: vi.fn(),
    logErrorSpy: vi.fn(),
    logWarnSpy: vi.fn(),
}));

vi.mock('../../auth', () => ({
    getBearerToken: getBearerTokenSpy,
    markBearerTokenExpired: markBearerTokenExpiredSpy,
}));
vi.mock('../../shared-state', () => ({ CREDIT_API_BASE: 'https://api.example.test' }));
vi.mock('../../error-utils', () => ({ logError: logErrorSpy, logWarn: logWarnSpy }));

import { fetchWorkspaceCreditBalance } from '../credit-balance-fetcher';

beforeEach(() => {
    getBearerTokenSpy.mockClear();
    getBearerTokenSpy.mockResolvedValue('tok_synthetic_401_regression_0000');
    markBearerTokenExpiredSpy.mockClear();
    logErrorSpy.mockClear();
    logWarnSpy.mockClear();
});

describe('credit-balance-fetcher synthetic 401 regression', () => {
    it('routes a 401 through logError once, marks token expired, returns AuthError outcome', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })));

        const result = await fetchWorkspaceCreditBalance({
            workspaceId: 'ws_401_synth',
            plan: Plan.Pro1,
            timeoutMs: 1000,
        });

        expect(result.outcome).toBe(CreditFetchOutcome.AuthError);
        expect(result.balance).toBeNull();
        expect(result.errorDetail).toMatch(/HTTP 401/);

        expect(markBearerTokenExpiredSpy).toHaveBeenCalledTimes(1);
        expect(markBearerTokenExpiredSpy).toHaveBeenCalledWith('credit-balance-update');

        expect(logErrorSpy).toHaveBeenCalledTimes(1);
        const [ns, payloadJson] = logErrorSpy.mock.calls[0] as [string, string];
        expect(ns).toBe('CreditBalanceUpdate.fetch');
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;
        expect(payload.Reason).toBe('AuthError');
        expect(payload.Status).toBe(401);
        expect(payload.WorkspaceId).toBe('ws_401_synth');
        expect(payload.BearerPrefix).toMatch(/REDACTED$/);
        expect(payload.BodyPreview).toBe('unauthorized');
        expect(payload.SourceUrl).toMatch(/\/workspaces\/ws_401_synth\/credit-balance$/);
    });

    it('never resolves to a success outcome when the server returns 401', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
        const result = await fetchWorkspaceCreditBalance({
            workspaceId: 'ws_401_synth',
            plan: Plan.Pro1,
            timeoutMs: 1000,
        });
        expect(result.outcome).not.toBe(CreditFetchOutcome.ApiHit);
        expect(result.outcome).not.toBe(CreditFetchOutcome.InlineHit);
    });
});
