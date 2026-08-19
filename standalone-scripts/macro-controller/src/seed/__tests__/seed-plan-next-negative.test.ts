import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { seedPlanNextPrompts } from '../seed-plan-next';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let responsesQueue: Record<string, unknown>[] = [];
let doThrowOnThird = false;
let callCount = 0;

vi.mock('../../db/extension-bridge', () => ({
  sendToExtension: vi.fn(async (_c: string, p: { method: string; params: { sql: string } }) => {
    captured.push({ method: p.method, sql: p.params.sql });
    callCount++;

    if (doThrowOnThird && callCount === 3) {
      throw new Error('mid-batch throw');
    }

    return responsesQueue.shift() ?? { ok: true, isFail: false, isSuccess: true, rows: [] };
  }),
}));

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');

  return { ...actual, logError: vi.fn(), logDiagnosticFromCode: vi.fn() };
});

vi.mock('../../logging', () => ({
  log: vi.fn(),
}));

describe('seed-plan-next negative tests (Gap 11)', () => {
  beforeEach(() => {
    captured.length = 0;
    responsesQueue = [];
    doThrowOnThird = false;
    callCount = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes audit row even when insert throws mid-batch', async () => {
    // 1. pre-select (success)
    // 2. INSERT OR IGNORE (success)
    // 3. something else throws
    responsesQueue = [
      { ok: true, isFail: false, isSuccess: true, rows: [] }, // pre-select
      { ok: true, isFail: false, isSuccess: true }, // INSERT
    ];
    doThrowOnThird = true;

    const r = await seedPlanNextPrompts();
    
    // We expect ok to be false
    expect(r.ok).toBe(false);

    // We expect the audit row to have been written
    const hasAudit = captured.some(c => c.sql.startsWith('INSERT INTO PromptSeedAudit'));
    expect(hasAudit).toBe(true);
  });
});
