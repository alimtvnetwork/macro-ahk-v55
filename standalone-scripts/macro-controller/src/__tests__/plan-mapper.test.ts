import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Plan } from '../credit-balance-update/plan';

const { logErrorSpy } = vi.hoisted(() => ({
    logErrorSpy: vi.fn(),
}));

vi.mock('../error-utils', () => ({
    logError: logErrorSpy,
}));

import { mapPlanFromWire, shouldFetchCreditBalanceForPlan, formatPlanDisplayLabel } from '../credit-balance-update/plan-mapper';

beforeEach(() => {
    logErrorSpy.mockClear();
});

describe('credit-balance-update plan mapper', () => {
    it.each([
        ['pro_0', Plan.Pro0],
        ['pro_1', Plan.Pro1],
        ['pro_3', Plan.Pro3],
        ['ktlo', Plan.Ktlo],
        ['lite', Plan.Ktlo],
        ['ktlo_2', Plan.Ktlo],
        ['ktlo_3', Plan.Ktlo],
        ['KTLO_2', Plan.Ktlo],
        ['free', Plan.Free],
        ['cancelled', Plan.Cancelled],
        ['canceled', Plan.Cancelled],
        ['business', Plan.Business],
        ['enterprise', Plan.Enterprise],
        ['', Plan.Unknown],
        [null, Plan.Unknown],
    ])('maps %s to %s', (wire, expected) => {
        expect(mapPlanFromWire(wire)).toBe(expected);
    });

    it('logs CODE RED for unknown non-empty plans', () => {
        expect(mapPlanFromWire('future_plan')).toBe(Plan.Unknown);
        expect(logErrorSpy).toHaveBeenCalledTimes(1);
        expect(String(logErrorSpy.mock.calls[0][1])).toContain('[CODE RED]');
        expect(String(logErrorSpy.mock.calls[0][1])).toContain('future_plan');
    });

    it.each([
        [Plan.Ktlo, true],
        [Plan.Free, true],
        [Plan.Cancelled, true],
        [Plan.Pro0, true],
        [Plan.Pro1, false],
        [Plan.Pro3, false],
        [Plan.Business, false],
        [Plan.Enterprise, false],
        [Plan.Unknown, false],
    ])('shouldFetchCreditBalanceForPlan(%s) returns %s', (plan, expected) => {
        expect(shouldFetchCreditBalanceForPlan(plan)).toBe(expected);
    });

    it.each([
        ['ktlo_2', 'Light 2'],
        ['ktlo_3', 'Light 3'],
        ['KTLO_5', 'Light 5'],
        ['ktlo', 'Lite'],
        ['lite', 'Lite'],
        ['pro_0', 'Pro 0'],
        ['pro_1', 'Pro 1'],
        ['pro_3', 'Pro 3'],
        ['free', 'Free'],
        ['cancelled', 'Cancelled'],
        ['canceled', 'Cancelled'],
        ['business', 'Business'],
        ['enterprise', 'Enterprise'],
        ['', ''],
        [null, ''],
        ['future_plan', 'future_plan'],
    ])('formatPlanDisplayLabel(%s) returns %s', (wire, expected) => {
        expect(formatPlanDisplayLabel(wire)).toBe(expected);
    });
});
