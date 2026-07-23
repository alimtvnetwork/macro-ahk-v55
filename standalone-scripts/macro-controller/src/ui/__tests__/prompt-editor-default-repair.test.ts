/**
 * Default prompt editor repair regression.
 *
 * Missing Plan/Next defaults must be repaired into a real DB row before the
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
  return { ...actual, seedPlanNextPrompts: vi.fn(async () => ({ ok: true })) };
});

import { openDefaultPromptEditor } from '../prompt-editor';

function promptRow(role: PromptRole): Record<string, string | number | string[]> {
  return {
    Id: role === 'plan' ? 10 : 11,
    Slug: role + '-default',
    Name: role === 'plan' ? 'Plan default' : 'Next default',
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
    mocks.getPromptBySlug.mockResolvedValue({ ok: true, value: undefined });
    mocks.listPromptsByRole.mockReset();
    mocks.upsertPrompt.mockReset();
    mocks.setDefaultPromptForRole.mockReset();
    mocks.showToast.mockReset();
  });

  it('repairs a missing Plan default and opens edit mode on the DB row', async () => {
    const row = promptRow('plan');
    mocks.getDefaultPromptForRole
      .mockResolvedValueOnce({ ok: true, value: undefined })
      .mockResolvedValueOnce({ ok: true, value: row });
    mocks.upsertPrompt.mockResolvedValue({ ok: true, value: row.Id });
    mocks.setDefaultPromptForRole.mockResolvedValue({ ok: true });
    mocks.listPromptsByRole.mockResolvedValue({ ok: true, value: [row] });

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
      .mockResolvedValueOnce({ ok: true, value: undefined })
      .mockResolvedValueOnce({ ok: true, value: undefined });
    mocks.upsertPrompt.mockResolvedValue({ ok: false, error: 'UNIQUE constraint failed: Prompt.Slug' });
    mocks.setDefaultPromptForRole.mockResolvedValue({ ok: true });
    mocks.listPromptsByRole.mockResolvedValue({ ok: true, value: [row] });

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
      .mockResolvedValueOnce({ ok: true, value: undefined })
      .mockResolvedValueOnce({ ok: true, value: undefined });
    mocks.upsertPrompt.mockResolvedValueOnce({ ok: true, value: adoptedRow.Id });
    mocks.listPromptsByRole.mockResolvedValue({ ok: true, value: [adoptedRow] });
    mocks.getPromptBySlug.mockResolvedValue({ ok: true, value: orphanRow });
    mocks.setDefaultPromptForRole.mockResolvedValue({ ok: true });

    await openDefaultPromptEditor('plan');

    expect(mocks.upsertPrompt.mock.calls[0]?.[0]).toMatchObject({ id: adoptedRow.Id, role: 'plan' });
    expect(mocks.openPromptCreationModal.mock.calls[0]?.[2]).toMatchObject({ id: String(adoptedRow.Id), role: 'plan' });
  });

  it('does not open seeded add-mode fallback when repair fails', async () => {
    mocks.getDefaultPromptForRole
      .mockResolvedValueOnce({ ok: true, value: undefined })
      .mockResolvedValueOnce({ ok: true, value: undefined });
    mocks.upsertPrompt.mockResolvedValue({ ok: false, error: 'write failed' });
    mocks.listPromptsByRole.mockResolvedValue({ ok: true, value: [] });

    await openDefaultPromptEditor('next');

    expect(mocks.openPromptCreationModal).not.toHaveBeenCalled();
    // Plan 26 step 8: toast now carries a diagnostic code suffix.
    const errorToast = mocks.showToast.mock.calls.find(([, level]) => level === 'error');
    expect(errorToast?.[0]).toContain('Default prompt repair failed');
    expect(errorToast?.[0]).toContain('[code=PROMPT_EDIT_E005]');
  });
});