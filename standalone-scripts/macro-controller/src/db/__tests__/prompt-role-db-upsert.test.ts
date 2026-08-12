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

import { upsertForRole } from '../prompt-role-db';
import { upsertPrompt } from '../prompt-db';
import { PromptRole } from '../../types/prompt-role';

beforeEach(() => {
  responsesQueue = null;
  nextResponse = { ok: true, isFail: false, isSuccess: true, rows: [] };
});

describe('upsertForRole negative branches (Plan 22 gap #3)', () => {
  it('upsertForRole fails with bad role', async () => {
    const r = await upsertForRole({
      slug: 's', name: 'n', body: 'b', role: 'invalid_role' as PromptRole,
    });
    
    expect(r.isSuccess).toBe(false);
    expect(r.error).toMatch(/invalid role/);
  });

  it('token-parity failure blocks write during upsertForRole', async () => {
    // If a plan prompt changes token params entirely, token parity fails
    const r = await upsertForRole({
      slug: 's', name: 'n', 
      previousBody: 'Use {{foo}}',
      body: 'Use {{bar}}',
      role: 'plan',
    });
    
    expect(r.isSuccess).toBe(false);
    expect(r.error).toMatch(/ParamTokenMismatch/);
  });
});
