/**
 * Tests for chat-submit-rename-backfill (plan 13 step 8).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/project-chat-submit-db', () => ({
  renameProjectChatSubmits: vi.fn(),
}));

vi.mock('../../error-utils', () => ({
  logError: vi.fn(),
}));

import {
  installChatSubmitRenameBackfill,
  _resetChatSubmitRenameBackfillForTests,
} from '../chat-submit-rename-backfill';
import {
  notifyIfProjectRenamed,
  _resetProjectIdentityStateForTests,
} from '../../util/project-id-from-url';
import * as db from '../../db/project-chat-submit-db';
import * as errorUtils from '../../error-utils';

const renameMock = db.renameProjectChatSubmits as unknown as ReturnType<typeof vi['fn']>;
const logErrorMock = errorUtils.logError as unknown as ReturnType<typeof vi['fn']>;

vi.mock('../../workspace-detection', () => ({
  extractProjectIdFromUrl: vi.fn(),
}));
vi.mock('../../logging', () => ({
  getDisplayProjectName: vi.fn(),
}));

import * as ws from '../../workspace-detection';
import * as logging from '../../logger';

const extractIdMock = ws.extractProjectIdFromUrl as unknown as ReturnType<typeof vi['fn']>;
const getNameMock = logging.getDisplayProjectName as unknown as ReturnType<typeof vi['fn']>;

beforeEach(() => {
  vi.clearAllMocks();
  _resetChatSubmitRenameBackfillForTests();
  _resetProjectIdentityStateForTests();
});

async function flush(): Promise<void> {
  // Two microtask ticks — subscribe callback + async handleRename.
  await Promise.resolve();
  await Promise.resolve();
}

describe('chat-submit-rename-backfill', () => {
  it('is idempotent: install twice registers only one listener', async () => {
    installChatSubmitRenameBackfill();
    installChatSubmitRenameBackfill();
    extractIdMock.mockReturnValue('p1');
    getNameMock.mockReturnValue('Alpha');
    notifyIfProjectRenamed(); // first-seen seeds
    getNameMock.mockReturnValue('Beta');
    renameMock.mockResolvedValue(true);
    notifyIfProjectRenamed(); // rename
    await flush();
    expect(renameMock).toHaveBeenCalledTimes(1);
    expect(renameMock).toHaveBeenCalledWith('p1', 'Beta');
  });

  it('calls renameProjectChatSubmits on rename', async () => {
    installChatSubmitRenameBackfill();
    extractIdMock.mockReturnValue('p1');
    getNameMock.mockReturnValue('Old');
    notifyIfProjectRenamed();
    getNameMock.mockReturnValue('New');
    renameMock.mockResolvedValue(true);
    notifyIfProjectRenamed();
    await flush();
    expect(renameMock).toHaveBeenCalledWith('p1', 'New');
  });

  it('skips rename-to-null and logs', async () => {
    installChatSubmitRenameBackfill();
    extractIdMock.mockReturnValue('p1');
    getNameMock.mockReturnValue('Named');
    notifyIfProjectRenamed();
    getNameMock.mockReturnValue(null);
    notifyIfProjectRenamed();
    await flush();
    expect(renameMock).not.toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledWith(
      'ChatSubmitRenameBackfill',
      expect.stringContaining('skip: newName is null'),
    );
  });

  it('logs when renameProjectChatSubmits returns false', async () => {
    installChatSubmitRenameBackfill();
    extractIdMock.mockReturnValue('p1');
    getNameMock.mockReturnValue('A');
    notifyIfProjectRenamed();
    getNameMock.mockReturnValue('B');
    renameMock.mockResolvedValue(false);
    notifyIfProjectRenamed();
    await flush();
    expect(logErrorMock).toHaveBeenCalledWith(
      'ChatSubmitRenameBackfill',
      expect.stringContaining('renameProjectChatSubmits failed'),
    );
  });

  it('does not fire on first-seen (seed only)', async () => {
    installChatSubmitRenameBackfill();
    extractIdMock.mockReturnValue('p1');
    getNameMock.mockReturnValue('First');
    notifyIfProjectRenamed();
    await flush();
    expect(renameMock).not.toHaveBeenCalled();
  });
});
