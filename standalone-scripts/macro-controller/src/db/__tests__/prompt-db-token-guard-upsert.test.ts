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

import { upsertPrompt } from '../prompt-db';

beforeEach(() => {
  responsesQueue = null;
  nextResponse = { ok: true, isFail: false, isSuccess: true, rows: [] };
});

describe('token-guard integration (Plan 22 gap #4)', () => {
  it('guard fires during upsert (blocks removing a parameter)', async () => {
    // Attempting to upsert a 'plan' prompt, changing {{foo}} to {{bar}}
    // Since previousBody is provided, checkTokenGuard is called in upsertPrompt.
    const r = await upsertPrompt({
      id: 1,
      slug: 'my-plan',
      name: 'Plan',
      previousBody: 'This uses {{foo}} and {{bar}}',
      body: 'This only uses {{bar}}',
      role: 'plan'
    });
    expect(r.isSuccess).toBe(false);
    expect(r.error).toMatch(/ParamTokenMismatch/);
  });

  it('guard fires during upsert (blocks adding a parameter)', async () => {
    const r = await upsertPrompt({
      id: 1,
      slug: 'my-plan',
      name: 'Plan',
      previousBody: 'This uses {{foo}}',
      body: 'This uses {{foo}} and {{bar}}',
      role: 'plan'
    });
    expect(r.isSuccess).toBe(false);
    expect(r.error).toMatch(/ParamTokenMismatch/);
  });
});
