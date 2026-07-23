import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GrantType } from '../credit-balance-update/grant-type';

const { logErrorSpy } = vi.hoisted(() => ({
    logErrorSpy: vi.fn(),
}));

vi.mock('../error-utils', () => ({
    logError: logErrorSpy,
}));

import { mapGrantTypeFromWire } from '../credit-balance-update/grant-type-mapper';

beforeEach(() => {
    logErrorSpy.mockClear();
});

describe('credit-balance-update grant type mapper', () => {
    it.each([
        ['daily', GrantType.Daily],
        ['billing', GrantType.Billing],
        ['billing_period', GrantType.Billing],
        ['monthly', GrantType.Billing],
        ['granted', GrantType.Granted],
        ['free', GrantType.Granted],
        ['topup', GrantType.Topup],
        ['top_up', GrantType.Topup],
        ['bonus', GrantType.Bonus],
        ['promotional', GrantType.Bonus],
        ['rollover', GrantType.Rollover],
        ['', GrantType.Unknown],
        [null, GrantType.Unknown],
    ])('maps %s to %s', (wire, expected) => {
        expect(mapGrantTypeFromWire(wire)).toBe(expected);
    });

    it('logs CODE RED for unknown non-empty grant types', () => {
        expect(mapGrantTypeFromWire('mystery')).toBe(GrantType.Unknown);
        expect(logErrorSpy).toHaveBeenCalledTimes(1);
        expect(String(logErrorSpy.mock.calls[0][1])).toContain('[CODE RED]');
        expect(String(logErrorSpy.mock.calls[0][1])).toContain('mystery');
    });
});
