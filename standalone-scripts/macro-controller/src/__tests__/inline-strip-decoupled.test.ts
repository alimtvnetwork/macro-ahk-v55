/**
 * Plan 09 invariant: the inline Plan/Next strips are paste-only stagers.
 * Only the Repeat strip is allowed to submit/loop. This test pins the
 * INLINE_AUTOCHAIN_DISABLED guard and verifies stageNextPrompt never calls
 * a submit dispatcher.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logging', () => ({ log: vi.fn() }));
vi.mock('../error-utils', () => ({ logError: vi.fn() }));
vi.mock('../xpath-utils', () => ({ getByXPath: () => null }));
vi.mock('../shared-state', () => ({
  cPanelFg: '#fff', cPrimaryLight: '#fff', cSectionBg: '#000',
}));

const mocks = vi.hoisted(() => ({
  pasteToast: vi.fn(),
  pasteIntoEditor: vi.fn(async () => 'ok'),
  findPasteTarget: vi.fn(() => null),
}));
vi.mock('../ui/prompt-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/prompt-utils')>();
  return {
    ...actual,
    showPasteToast: mocks.pasteToast,
    pasteIntoEditor: mocks.pasteIntoEditor,
    findPasteTarget: mocks.findPasteTarget,
  };
});
vi.mock('../ui/prompt-manager', () => ({
  DEFAULT_PROMPTS: [{ slug: 'next-steps', text: 'DEFAULT NEXT ${N} BODY', replaceKey: 'N' }],
  getPromptsConfig: () => ({ entries: [] }),
}));
vi.mock('../ui/task-splitter-ui', () => ({
  triggerPlanPasteFromInline: vi.fn(),
  isSplitterRunning: () => false,
}));
vi.mock('../ui/task-next-ui', () => ({
  taskNextState: { running: false },
  findNextTasksPrompt: () => ({ text: 'LEGACY-NEXT-BODY' }),
}));
// plan-14 step 16: stageNextPrompt now dynamically imports prompt-db and
// prefers the DB `next-default` row. Force the miss path so the JSON-library
// resolver still runs — that's what these tests pin.
vi.mock('../db/prompt-db', () => ({
  getDefaultPromptForRole: vi.fn(async () => ({ ok: true, value: undefined })),
}));

import {
  INLINE_AUTOCHAIN_DISABLED,
  stageNextPrompt,
} from '../ui/next-inline-ui';
import type { TaskNextDeps } from '../ui/task-next-ui';

const deps = {
  getPromptsConfig: () => ({ entries: [] }),
} as unknown as TaskNextDeps;

describe('inline strip decoupling (plan 09)', () => {
  beforeEach(() => {
    mocks.pasteToast.mockClear();
    mocks.pasteIntoEditor.mockClear();
  });

  it('INLINE_AUTOCHAIN_DISABLED is true (invariant)', () => {
    expect(INLINE_AUTOCHAIN_DISABLED).toBe(true);
  });

  it('stageNextPrompt pastes the prompt body and never submits', async () => {
    await stageNextPrompt(deps, 3);
    expect(mocks.pasteIntoEditor).toHaveBeenCalledTimes(1);
    const [text] = mocks.pasteIntoEditor.mock.calls[0];
    expect(String(text)).toContain('DEFAULT NEXT 3 BODY');
    expect(mocks.pasteToast).toHaveBeenCalledWith(
      expect.stringContaining('staged'),
      false,
    );
  });

  it('stageNextPrompt prefers the next-${N}-steps variant when present', async () => {
    const customDeps = {
      getPromptsConfig: () => ({
        entries: [{ slug: 'next-5-steps', text: 'VARIANT-{{n}}-BODY' }],
      }),
    } as unknown as TaskNextDeps;
    await stageNextPrompt(customDeps, 5);
    const [text] = mocks.pasteIntoEditor.mock.calls[0];
    expect(String(text)).toContain('VARIANT-5-BODY');
    expect(String(text)).not.toContain('{{n}}');
  });

  it('stageNextPrompt uses the DB next-default row with {{n}} substituted when present (plan-14 step 16)', async () => {
    const promptDb = await import('../db/prompt-db');
    const spy = vi.mocked(promptDb.getDefaultPromptForRole);
    spy.mockResolvedValueOnce({
      ok: true,
      value: { Id: 1, Slug: 'next-default', Name: 'Next (default)', Body: 'DB-NEXT for N={{n}} end', Role: 'next', IsDefault: 1, CreatedAt: 0, UpdatedAt: 0 },
    } as never);
    await stageNextPrompt(deps, 7);
    const [text] = mocks.pasteIntoEditor.mock.calls[0];
    expect(String(text)).toContain('DB-NEXT for N=7 end');
    spy.mockReset();
  });
});

