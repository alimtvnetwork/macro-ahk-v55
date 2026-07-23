import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDefaultPromptForRole: vi.fn(),
  pasteIntoEditor: vi.fn(async () => 'injected'),
  showPasteToast: vi.fn(),
  findPasteTarget: vi.fn(() => null),
}));

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));
vi.mock('../../xpath-utils', () => ({
  getByXPath: () => null,
  isReturnButtonVisible: () => false,
}));
vi.mock('../../shared-state', () => ({
  cPanelFg: '#fff', cPrimaryLight: '#fff', cSectionBg: '#111',
}));
vi.mock('../../queue-control/task-queue-project-store', () => ({
  getPersistentTaskQueue: () => ({ enqueueMany: vi.fn() }),
  resolveTaskQueueProjectId: () => 'project',
}));
vi.mock('../../settings-store', () => ({ getSettingsOverrides: () => ({}) }));
vi.mock('../task-next-ui', () => ({ findAddToTasksButton: () => null }));
vi.mock('../prompt-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../prompt-utils')>();
  return {
    ...actual,
    pasteIntoEditor: mocks.pasteIntoEditor,
    showPasteToast: mocks.showPasteToast,
    findPasteTarget: mocks.findPasteTarget,
  };
});
vi.mock('../prompt-manager', () => ({
  DEFAULT_PROMPTS: [],
  getPromptsConfig: () => ({ entries: [] }),
}));
vi.mock('../../db/prompt-db', () => ({
  getDefaultPromptForRole: mocks.getDefaultPromptForRole,
}));

import { getLastPlanPromptSource, triggerPlanPasteFromInline } from '../task-splitter-ui';

describe('task splitter Plan strip resolver', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mocks.getDefaultPromptForRole.mockReset();
    mocks.pasteIntoEditor.mockClear();
    mocks.showPasteToast.mockClear();
  });

  it('uses the managed plan default row before the hidden prompt library', async () => {
    mocks.getDefaultPromptForRole.mockResolvedValue({
      ok: true,
      value: { Body: 'DB Plan {{n}} body', ReplaceKey: 'n' },
    });

    await triggerPlanPasteFromInline(12);

    expect(mocks.pasteIntoEditor.mock.calls[0]?.[0]).toBe('DB Plan 12 body');
    expect(getLastPlanPromptSource()).toBe('db-default');
    expect(mocks.showPasteToast).not.toHaveBeenCalledWith(expect.stringContaining('not found'), true);
  });

  it('falls back to the bundled Plan v4.1 body when no prompt row exists', async () => {
    mocks.getDefaultPromptForRole.mockResolvedValue({ ok: true, value: undefined });

    await triggerPlanPasteFromInline(50);

    const pasted = String(mocks.pasteIntoEditor.mock.calls[0]?.[0] ?? '');
    expect(pasted).toContain('# 50 number of steps plan, maximum enforcement (v4.1)');
    expect(pasted).not.toContain('{{n}}');
    expect(mocks.showPasteToast).not.toHaveBeenCalledWith(expect.stringContaining('not found'), true);
  });
});