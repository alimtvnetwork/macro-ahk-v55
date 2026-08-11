import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlanTierType } from '../credit-balance-update/plan';

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
    ['pro_0', PlanTierType.Pro0],
    ['pro_1', PlanTierType.Pro1],
    ['pro_3', PlanTierType.Pro3],
    ['ktlo', PlanTierType.Ktlo],
    ['lite', PlanTierType.Ktlo],
    ['ktlo_2', PlanTierType.Ktlo],
    ['ktlo_3', PlanTierType.Ktlo],
    ['KTLO_2', PlanTierType.Ktlo],
    ['free', PlanTierType.Free],
    ['cancelled', PlanTierType.Cancelled],
    ['canceled', PlanTierType.Cancelled],
    ['business', PlanTierType.Business],
    ['enterprise', PlanTierType.Enterprise],
    ['', PlanTierType.Unknown],
    [null, PlanTierType.Unknown],
  ])('maps %s to %s', (wire, expected) => {
    expect(mapPlanFromWire(wire)).toBe(expected);
  });

  it('logs CODE RED for unknown non-empty plans', () => {
    expect(mapPlanFromWire('future_plan')).toBe(PlanTierType.Unknown);
    expect(logErrorSpy).toHaveBeenCalledTimes(1);
    expect(String(logErrorSpy.mock.calls[0][1])).toContain('[CODE RED]');
    expect(String(logErrorSpy.mock.calls[0][1])).toContain('future_plan');
  });

  it.each([
    [PlanTierType.Ktlo, true],
    [PlanTierType.Free, true],
    [PlanTierType.Cancelled, true],
    [PlanTierType.Pro0, true],
    [PlanTierType.Pro1, false],
    [PlanTierType.Pro3, false],
    [PlanTierType.Business, false],
    [PlanTierType.Enterprise, false],
    [PlanTierType.Unknown, false],
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
