import { DbResult } from '../../db/db-result';
/**
 * Default prompt editor repair regression.
 *
 * Missing PlanTierType/Next defaults must be repaired into a real DB row before the
 * editor opens. Opening a seeded add-mode fallback makes Save create another
 * non-default row, so this test locks the edit-mode path and the no-fallback
 * failure path.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PromptRole } from '../../types/prompt-role';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

const mocks = vi.hoisted(() => ({
  openPromptCreationModal: vi.fn(),
  getDefaultPromptForRole: vi.fn(),
  getPromptBySlug: vi.fn(),
  listPromptsByRole: vi.fn(),
  upsertPrompt: vi.fn(),
  setDefaultPromptForRole: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../prompt-loader', () => buildPromptLoaderMock({
  getRevalidateContext: () => ({ context: { promptsDropdown: document.createElement('div') }, taskNextDeps: {} }),
}));

vi.mock('../prompt-injection', () => ({
  openPromptCreationModal: mocks.openPromptCreationModal,
}));

vi.mock('../../db/prompt-db', () => ({
    DbResult,
    DbResult,
    DbResult,
  getDefaultPromptForRole: mocks.getDefaultPromptForRole,
  getPromptBySlug: mocks.getPromptBySlug,
  listPromptsByRole: mocks.listPromptsByRole,
  upsertPrompt: mocks.upsertPrompt,
  setDefaultPromptForRole: mocks.setDefaultPromptForRole,
}));

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');

  return { ...actual, logError: vi.fn() };
});

vi.mock('../../toast', () => ({ showToast: mocks.showToast }));

vi.mock('../../telemetry/prompt-seed-telemetry', () => ({ emitPromptSeedEvent: vi.fn() }));

vi.mock('../../seed/seed-plan-next', async () => {
  const actual = await vi.importActual<typeof import('../../seed/seed-plan-next')>('../../seed/seed-plan-next');

  return { ...actual, seedPlanNextPrompts: vi.fn(async () => (new DbResult(true, undefined))) };
});

import { openDefaultPromptEditor } from '../prompt-editor';

function promptRow(role: PromptRole): Record<string, string | number | string[]> {
  return {
    Id: role === 'plan' ? 10 : 11,
    Slug: role + '-default',
    Name: role === 'plan' ? 'PlanTierType default' : 'Next default',
    Body: 'Default body with {{n}} token',
    Role: role,
    IsDefault: 1,
    ReplaceKey: 'n',
    ReplaceValues: ['1', '2'],
    CreatedAt: 1,
    UpdatedAt: 2,
  };
}

describe('openDefaultPromptEditor default repair', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mocks.openPromptCreationModal.mockClear();
    mocks.getDefaultPromptForRole.mockReset();
    mocks.getPromptBySlug.mockReset();
    mocks.getPromptBySlug.mockResolvedValue(new DbResult(true, undefined));
    mocks.listPromptsByRole.mockReset();
    mocks.upsertPrompt.mockReset();
    mocks.setDefaultPromptForRole.mockReset();
    mocks.showToast.mockReset();
  });

  it('repairs a missing PlanTierType default and opens edit mode on the DB row', async () => {
    const row = promptRow('plan');
    mocks.getDefaultPromptForRole
      .mockResolvedValueOnce(new DbResult(true, undefined))
      .mockResolvedValueOnce(new DbResult(true, row));
    mocks.upsertPrompt.mockResolvedValue(new DbResult(true, row.Id));
    mocks.setDefaultPromptForRole.mockResolvedValue(new DbResult(true, undefined));
    mocks.listPromptsByRole.mockResolvedValue(new DbResult(true, [row]));

    await openDefaultPromptEditor('plan');

    expect(mocks.upsertPrompt).toHaveBeenCalledWith(expect.objectContaining({ slug: 'plan-default', role: 'plan' }));
    expect(mocks.setDefaultPromptForRole).toHaveBeenCalledWith(row.Id, 'plan');
    expect(mocks.openPromptCreationModal).toHaveBeenCalledOnce();
    expect(mocks.openPromptCreationModal.mock.calls[0]?.[2]).toMatchObject({ id: String(row.Id), role: 'plan' });
    expect(mocks.openPromptCreationModal.mock.calls[0]?.[3]).toBeUndefined();
  });

  it('promotes an existing seeded Next row when the default flag is missing', async () => {
    const row = { ...promptRow('next'), IsDefault: 0 };
    mocks.getDefaultPromptForRole
      .mockResolvedValueOnce(new DbResult(true, undefined))
      .mockResolvedValueOnce(new DbResult(true, undefined));
    mocks.upsertPrompt.mockResolvedValue(new DbResult(false, undefined, 'UNIQUE constraint failed: Prompt.Slug'));
    mocks.setDefaultPromptForRole.mockResolvedValue(new DbResult(true, undefined));
    mocks.listPromptsByRole.mockResolvedValue(new DbResult(true, [row]));

    await openDefaultPromptEditor('next');

    expect(mocks.setDefaultPromptForRole).toHaveBeenCalledWith(row.Id, 'next');
    expect(mocks.openPromptCreationModal).toHaveBeenCalledOnce();
    expect(mocks.openPromptCreationModal.mock.calls[0]?.[2]).toMatchObject({ id: String(row.Id), role: 'next' });
    expect(mocks.openPromptCreationModal.mock.calls[0]?.[3]).toBeUndefined();
  });

  it('adopts an orphaned seed slug before opening the default editor', async () => {
    const adoptedRow = promptRow('plan');
    const orphanRow = { ...adoptedRow, Role: 'generic', IsDefault: 0 };
    mocks.getDefaultPromptForRole
      .mockResolvedValueOnce(new DbResult(true, undefined))
      .mockResolvedValueOnce(new DbResult(true, undefined));
    mocks.upsertPrompt.mockResolvedValueOnce(new DbResult(true, adoptedRow.Id));
    mocks.listPromptsByRole.mockResolvedValue(new DbResult(true, [adoptedRow]));
    mocks.getPromptBySlug.mockResolvedValue(new DbResult(true, orphanRow));
    mocks.setDefaultPromptForRole.mockResolvedValue(new DbResult(true, undefined));

    await openDefaultPromptEditor('plan');

    expect(mocks.upsertPrompt.mock.calls[0]?.[0]).toMatchObject({ id: adoptedRow.Id, role: 'plan' });
    expect(mocks.openPromptCreationModal.mock.calls[0]?.[2]).toMatchObject({ id: String(adoptedRow.Id), role: 'plan' });
  });

  it('does not open seeded add-mode fallback when repair fails', async () => {
    mocks.getDefaultPromptForRole
      .mockResolvedValueOnce(new DbResult(true, undefined))
      .mockResolvedValueOnce(new DbResult(true, undefined));
    mocks.upsertPrompt.mockResolvedValue(new DbResult(false, undefined, 'write failed'));
    mocks.listPromptsByRole.mockResolvedValue(new DbResult(true, []));

    await openDefaultPromptEditor('next');

    expect(mocks.openPromptCreationModal).not.toHaveBeenCalled();
    // PlanTierType 26 step 8: toast now carries a diagnostic code suffix.
    const errorToast = mocks.showToast.mock.calls.find(([, level]) => level === 'error');
    expect(errorToast?.[0]).toContain('Default prompt lookup failed');
    expect(errorToast?.[0]).toContain('[code=PROMPT_EDIT_E005]');
  });
});