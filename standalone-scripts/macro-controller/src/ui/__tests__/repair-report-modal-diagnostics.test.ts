import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
  return { ...actual, logDiagnosticFromCode: vi.fn() };
});

import * as errorUtils from '../../error-utils';
const logDiagnosticFromCode = errorUtils.logDiagnosticFromCode as unknown as Mock;

import { stashRepairReport, type RepairReportSummary } from '../repair-report-modal';

function base(overrides: Partial<RepairReportSummary> = {}): RepairReportSummary {
  return {
    fixed: [],
    stillBroken: [],
    newlyFlagged: [],
    reseedAttempted: false,
    reseedOk: true,
    isHealthy: true,
    initialCount: 0,
    finalCount: 0,
    checkedAt: Date.now(),
    ...overrides,
  };
}

describe('repair-report-modal diagnostics (Plan 26 step 14)', () => {
  beforeEach(() => { logDiagnosticFromCode.mockReset(); });

  it('emits no diagnostics when repair is healthy', () => {
    stashRepairReport(base());
    expect(logDiagnosticFromCode).not.toHaveBeenCalled();
  });

  it('emits REPAIR_RESEED_E001 when reseed fails', () => {
    stashRepairReport(base({
      reseedAttempted: true, reseedOk: false, reseedError: 'SQL BUSY',
      isHealthy: false, initialCount: 3, finalCount: 3,
      stillBroken: [{ role: 'plan', slug: 'default', code: 'HEALTH_E001', detail: 'missing' } as never],
    }));
    const codes = logDiagnosticFromCode.mock.calls.map((c) => c[0]);
    expect(codes).toContain('REPAIR_RESEED_E001');
    const call = logDiagnosticFromCode.mock.calls.find((c) => c[0] === 'REPAIR_RESEED_E001')!;
    expect(call[1]).toMatchObject({ initialCount: 3, reason: 'SQL BUSY' });
  });

  it('emits REPAIR_RESIDUAL_E001 when issues remain', () => {
    stashRepairReport(base({
      isHealthy: false, initialCount: 4, finalCount: 2,
      fixed: [{ role: 'plan', slug: 'a', code: 'X', detail: 'd' } as never, { role: 'next', slug: 'b', code: 'X', detail: 'd' } as never],
      stillBroken: [{ role: 'plan', slug: 'c', code: 'X', detail: 'd' } as never],
      newlyFlagged: [{ role: 'next', slug: 'd', code: 'X', detail: 'd' } as never],
    }));
    const call = logDiagnosticFromCode.mock.calls.find((c) => c[0] === 'REPAIR_RESIDUAL_E001')!;
    expect(call).toBeDefined();
    expect(call[1]).toMatchObject({
      finalCount: 2, fixedCount: 2, stillBrokenCount: 1, newlyFlaggedCount: 1,
    });
  });
});
