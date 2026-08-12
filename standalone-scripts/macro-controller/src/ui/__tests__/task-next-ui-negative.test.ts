import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runTaskNextLoop } from '../task-next-ui';
import { DbResult } from '../../db/db-result';

// Mock dependencies
const listPromptsByRoleMock = vi.hoisted(() => vi.fn());
vi.mock('../../db/prompt-db', () => ({
  listPromptsByRole: listPromptsByRoleMock,
}));

const pasteIntoEditorMock = vi.hoisted(() => vi.fn());
const showPasteToastMock = vi.hoisted(() => vi.fn());
vi.mock('../prompt-utils', () => ({
  pasteIntoEditor: pasteIntoEditorMock,
  showPasteToast: showPasteToastMock,
}));

import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

vi.mock('../prompt-loader', () => buildPromptLoaderMock({
  getPromptsConfig: () => ({ entries: [] } as any),
}));

vi.mock('../../queue-control/task-queue-project-store', () => ({
  resolveTaskQueueProjectId: vi.fn().mockReturnValue('mock-proj'),
  getPersistentTaskQueue: vi.fn().mockReturnValue({
    dequeue: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
  }),
}));

vi.mock('../../xpath-utils', () => ({
  getByXPath: vi.fn(),
}));

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');

  return { ...actual, logError: vi.fn() };
});

vi.mock('../../logger', () => ({
  log: vi.fn(),
  logSub: vi.fn(),
}));

describe('task-next-ui negative paths (Gap 12)', () => {
  let deps: any;

  beforeEach(() => {
    listPromptsByRoleMock.mockReset();
    pasteIntoEditorMock.mockReset();
    showPasteToastMock.mockReset();
    
    deps = {
      sendToExtension: vi.fn(),
      getPromptsConfig: vi.fn().mockReturnValue({ entries: [] }), // legacy cache empty
      getByXPath: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handles DB empty (returns 0 rows)', async () => {
    listPromptsByRoleMock.mockResolvedValue(new DbResult(true, []));
    
    await runTaskNextLoop(deps, 1);
    
    expect(showPasteToastMock).toHaveBeenCalledWith('❌ "Next Tasks" prompt not found', true);
    expect(pasteIntoEditorMock).not.toHaveBeenCalled();
  });

  it('handles DB row corrupt (missing body)', async () => {
    listPromptsByRoleMock.mockResolvedValue(new DbResult(true, [{ IsDefault: 1, Body: '' }]));
    
    await runTaskNextLoop(deps, 1);
    
    expect(showPasteToastMock).toHaveBeenCalledWith('❌ "Next Tasks" prompt not found', true);
    expect(pasteIntoEditorMock).not.toHaveBeenCalled();
  });

  it('handles DB unavailable (throws/returns isFail)', async () => {
    listPromptsByRoleMock.mockResolvedValue(new DbResult(false, undefined, 'DB error'));
    
    await runTaskNextLoop(deps, 1);
    
    expect(showPasteToastMock).toHaveBeenCalledWith('❌ "Next Tasks" prompt not found', true);
    expect(pasteIntoEditorMock).not.toHaveBeenCalled();
  });
});
