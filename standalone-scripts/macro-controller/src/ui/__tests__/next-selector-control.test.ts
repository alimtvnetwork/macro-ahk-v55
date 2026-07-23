/**
 * v4.170.5 regression: the ▶ Next selector control mounted on the Repeat
 * strip populates from `listPromptsByRole('next')`, marks the IsDefault row,
 * writes `setDefaultPromptForRole` on change, and opens the shared editor
 * when the ✎ button is clicked. Failures never throw and never leave the
 * widget in a phantom state — the `(unavailable)` hint surfaces instead.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const listPromptsByRoleMock = vi.fn();
const setDefaultPromptForRoleMock = vi.fn();
const openPromptEditorMock = vi.fn();

vi.mock('../../db/prompt-db', () => ({
  listPromptsByRole: (...args: unknown[]) => listPromptsByRoleMock(...args),
  setDefaultPromptForRole: (...args: unknown[]) => setDefaultPromptForRoleMock(...args),
}));

vi.mock('../prompt-editor', () => ({
  openPromptEditor: (...args: unknown[]) => openPromptEditorMock(...args),
}));

vi.mock('../prompt-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../prompt-utils')>();
  return {
    ...actual,
    showPasteToast: vi.fn(),
  };
});

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));
vi.mock('../../shared-state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared-state')>();
  return {
    ...actual,
    cPanelFg: '#fff',
    cPrimaryLight: '#a78bfa',
  };
});

import { buildNextSelectorControl } from '../next-selector-control';

const rows = [
  { Id: 1, Slug: 'next-default', Name: 'Next default', Body: 'x {{n}}', Role: 'next', IsDefault: 1, ReplaceKey: 'n', ReplaceValues: null, CreatedAt: '', UpdatedAt: '' },
  { Id: 2, Slug: 'next-alt', Name: 'Alternate Next', Body: 'y {{n}}', Role: 'next', IsDefault: 0, ReplaceKey: 'n', ReplaceValues: null, CreatedAt: '', UpdatedAt: '' },
];

beforeEach(() => {
  document.body.innerHTML = '';
  listPromptsByRoleMock.mockReset();
  setDefaultPromptForRoleMock.mockReset();
  openPromptEditorMock.mockReset();
});

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('next-selector-control', () => {
  it('populates the select and marks the IsDefault row as selected', async () => {
    listPromptsByRoleMock.mockResolvedValue({ ok: true, value: rows });
    const node = buildNextSelectorControl();
    document.body.appendChild(node);
    await flush();
    const select = node.querySelector('select') as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('1');
    expect(select.options[0].textContent).toContain('★');
  });

  it('calls setDefaultPromptForRole with the chosen id when changed', async () => {
    listPromptsByRoleMock.mockResolvedValue({ ok: true, value: rows });
    setDefaultPromptForRoleMock.mockResolvedValue({ ok: true, value: undefined });
    const node = buildNextSelectorControl();
    document.body.appendChild(node);
    await flush();
    const select = node.querySelector('select') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await flush();
    expect(setDefaultPromptForRoleMock).toHaveBeenCalledWith(2, 'next');
  });

  it('opens the prompt editor with the selected id when ✎ is clicked', async () => {
    listPromptsByRoleMock.mockResolvedValue({ ok: true, value: rows });
    openPromptEditorMock.mockResolvedValue(undefined);
    const node = buildNextSelectorControl();
    document.body.appendChild(node);
    await flush();
    const editBtn = node.querySelector('button') as HTMLButtonElement;
    editBtn.click();
    await flush();
    expect(openPromptEditorMock).toHaveBeenCalledWith({ role: 'next', promptId: 1 });
  });

  it('renders (unavailable) hint when listPromptsByRole fails', async () => {
    listPromptsByRoleMock.mockResolvedValue({ ok: false, error: 'boom' });
    const node = buildNextSelectorControl();
    document.body.appendChild(node);
    await flush();
    const hint = node.querySelector('[data-role="next-selector-hint"]') as HTMLSpanElement;
    expect(hint.textContent).toBe('(unavailable)');
    const select = node.querySelector('select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('renders (no prompts) hint when the DB returns an empty list', async () => {
    listPromptsByRoleMock.mockResolvedValue({ ok: true, value: [] });
    const node = buildNextSelectorControl();
    document.body.appendChild(node);
    await flush();
    const hint = node.querySelector('[data-role="next-selector-hint"]') as HTMLSpanElement;
    expect(hint.textContent).toBe('(no prompts)');
  });
});
