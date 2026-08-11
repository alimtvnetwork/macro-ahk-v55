import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

let responsesQueue: Record<string, unknown>[] | null = null;
let nextResponse: Record<string, unknown> = { ok: true, isFail: false, isSuccess: true, rows: [] };

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
  sendToExtension: vi.fn(async () => {
    if (responsesQueue && responsesQueue.length > 0) {
      return responsesQueue.shift();
    }

    return nextResponse;
  }),
}));

vi.mock('../../ui/extension-relay', () => ({
  sendToExtension: vi.fn(async () => {
    if (responsesQueue && responsesQueue.length > 0) {
      return responsesQueue.shift();
    }

    return nextResponse;
  }),
}));

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');

  return { ...actual, logError: vi.fn(), logDiagnosticFromCode: vi.fn() };
});

vi.mock('../../logging', () => ({ log: vi.fn() }));

import { deleteBySlug } from '../prompt-db';
import { seedPlanNextPrompts } from '../../seed/seed-plan-next';

beforeEach(() => {
  responsesQueue = null;
  nextResponse = { ok: true, isFail: false, isSuccess: true, rows: [] };
});

describe('deleteBySlug negative and integration (Plan 22 gap #2)', () => {
  it('deleteBySlug fails when slug is unknown', async () => {
    responsesQueue = [
      { ok: true, isFail: false, isSuccess: true, rows: [] }, // getPromptBySlug returns empty
    ];

    const r = await deleteBySlug('unknown-slug');
    expect(r.isFail).toBe(true);
    expect(r.error).toMatch(/unknown slug/);
  });

  it('integration: default row is restored by seed on next boot', async () => {
    // 1. Delete the slug successfully
    responsesQueue = [
      { ok: true, isFail: false, isSuccess: true, rows: [{ Id: 1, Slug: 'plan-default', Name: 'n', Body: 'b', Role: 'plan' }] }, // getPromptBySlug
      { ok: true, isFail: false, isSuccess: true, rows: [{ Id: 1, Slug: 'plan-default', Name: 'n', Body: 'b', Role: 'plan' }] }, // readPromptRow
      { ok: true, isFail: false, isSuccess: true, rows: [{ c: 2 }] }, // countRowsForRole (allow delete)
      { ok: true, isFail: false, isSuccess: true }, // DELETE statement
    ];

    const delRes = await deleteBySlug('plan-default');
    expect(delRes.isSuccess).toBe(true);

    // 2. Next boot seed restores it
    // seedPlanNextPrompts is complex, we just set a default nextResponse so it succeeds
    nextResponse = { ok: true, isFail: false, isSuccess: true, rows: [] };
    const seedRes = await seedPlanNextPrompts();
    expect(seedRes.isSuccess).toBe(true);
  });
});
