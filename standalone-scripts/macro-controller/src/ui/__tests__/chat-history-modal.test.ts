/**
 * Chat History Modal — DOM smoke tests (plan 13 step 9 shell).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../capture/chat-submit-history', () => ({
  getProjectHistory: vi.fn(),
  exportProjectHistoryAsJson: vi.fn(),
  deleteHistoryEntry: vi.fn(),
}));
vi.mock('../../workspace-detection', () => ({
  extractProjectIdFromUrl: vi.fn(),
}));
vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

import { showChatHistoryModal } from '../chat-history-modal';
import * as history from '../../capture/chat-submit-history';
import * as ws from '../../workspace-detection';

const getMock = history.getProjectHistory as unknown as ReturnType<typeof vi['fn']>;
const exportMock = history.exportProjectHistoryAsJson as unknown as ReturnType<typeof vi['fn']>;
const deleteMock = history.deleteHistoryEntry as unknown as ReturnType<typeof vi['fn']>;
const projectIdMock = ws.extractProjectIdFromUrl as unknown as ReturnType<typeof vi['fn']>;

const MODAL_ID = 'macroloop-chat-history-modal';

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('showChatHistoryModal', () => {
  it('renders overlay + toolbar + closes on ✕', async () => {
    projectIdMock.mockReturnValue('p1');
    getMock.mockResolvedValue([]);
    showChatHistoryModal();
    await flush();
    const overlay = document.getElementById(MODAL_ID);
    expect(overlay).not.toBeNull();
    expect(overlay!.querySelector('.marco-history-title')!.textContent).toContain('Chat History');
    expect(document.querySelector('.marco-history-empty')!.textContent).toContain('No chat submissions');
    (document.querySelector('.marco-history-close') as HTMLElement).click();
    expect(document.getElementById(MODAL_ID)).toBeNull();
  });

  it('is a toggle: second call closes the open modal', () => {
    projectIdMock.mockReturnValue('p1');
    getMock.mockResolvedValue([]);
    showChatHistoryModal();
    expect(document.getElementById(MODAL_ID)).not.toBeNull();
    showChatHistoryModal();
    expect(document.getElementById(MODAL_ID)).toBeNull();
  });

  it('renders entries with source + charCount + timestamp', async () => {
    projectIdMock.mockReturnValue('p1');
    getMock.mockResolvedValue([
      { id: 1, projectId: 'p1', projectName: 'A', source: 'paste', fileId: 'f1',
        charCount: 42, createdAt: 1_700_000_000_000, metaJson: null, body: 'hello world' },
    ]);
    showChatHistoryModal();
    await flush();
    const rows = document.querySelectorAll('.marco-history-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('paste');
    expect(rows[0].textContent).toContain('42 chars');
    expect(rows[0].textContent).toContain('hello world');
  });

  it('Copy JSON writes envelope to clipboard', async () => {
    projectIdMock.mockReturnValue('p1');
    getMock.mockResolvedValue([]);
    exportMock.mockResolvedValue({ schemaVersion: 1, projectId: 'p1', exportedAt: 0, entryCount: 0, entries: [] });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    showChatHistoryModal();
    await flush();
    const copyBtn = Array.from(document.querySelectorAll('.marco-history-btn'))
      .find((b) => b.textContent === 'Copy JSON') as HTMLElement;
    copyBtn.click();
    await flush();
    expect(writeText).toHaveBeenCalledTimes(1);
    const payload = writeText.mock.calls[0][0];
    expect(JSON.parse(payload)).toMatchObject({ schemaVersion: 1, projectId: 'p1' });
  });

  it('delete button removes row on success', async () => {
    projectIdMock.mockReturnValue('p1');
    getMock.mockResolvedValue([
      { id: 5, projectId: 'p1', projectName: null, source: 'repeat', fileId: 'f5',
        charCount: 10, createdAt: 0, metaJson: null, body: 'x' },
    ]);
    deleteMock.mockResolvedValue({ isDeleted: true, opfsRemoved: true, rowRemoved: true });
    showChatHistoryModal();
    await flush();
    const delBtn = document.querySelector('.marco-history-btn-danger') as HTMLElement;
    delBtn.click();
    await flush();
    expect(deleteMock).toHaveBeenCalledWith('p1', 5, 'f5');
    expect(document.querySelectorAll('.marco-history-row')).toHaveLength(0);
  });

  it('shows no-project message when URL has none', async () => {
    projectIdMock.mockReturnValue(null);
    showChatHistoryModal();
    await flush();
    expect(document.querySelector('.marco-history-status')!.textContent).toContain('No Lovable project');
    expect(getMock).not.toHaveBeenCalled();
  });
});
