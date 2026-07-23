/**
 * chat-submit-capture — unit tests (plan 13 step 6).
 *
 * Mocks the three primitives (OPFS store, SQLite CRUD, identity façade)
 * so we can assert the capture pipeline routes correctly under every
 * condition without touching the browser.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const opfsSave = vi.fn<(projectId: string, text: string) => Promise<string | null>>();
const dbInsert = vi.fn<(input: unknown) => Promise<boolean>>();
let mockedIdentity: { projectId: string | null; projectName: string | null } = { projectId: null, projectName: null };

vi.mock('../../storage/chat-submit-opfs-store', () => ({
  saveEntry: (pid: string, text: string) => opfsSave(pid, text),
}));

vi.mock('../../db/project-chat-submit-db', () => ({
  insertChatSubmit: (input: unknown) => dbInsert(input),
}));

vi.mock('../../util/project-id-from-url', () => ({
  resolveProjectIdentity: () => mockedIdentity,
  subscribeProjectNameChange: () => () => {},
  notifyIfProjectRenamed: () => {},
  extractProjectIdFromString: () => null,
}));

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
  return { ...actual, logError: vi.fn() };
});

import { captureChatSubmit } from '../chat-submit-capture';

beforeEach(() => {
  opfsSave.mockReset();
  dbInsert.mockReset();
  mockedIdentity = { projectId: null, projectName: null };
  opfsSave.mockResolvedValue('file-abc');
  dbInsert.mockResolvedValue(true);
});

describe('captureChatSubmit', () => {
  it('happy path: writes verbose text to OPFS, then inserts the DB row', async () => {
    mockedIdentity = { projectId: 'proj-1', projectName: 'Alpha' };
    const result = await captureChatSubmit({ source: 'repeat', text: 'hello\nworld', isVerbose: true });
    expect(result).toEqual({ isCaptured: true, projectId: 'proj-1', fileId: 'file-abc' });
    expect(opfsSave).toHaveBeenCalledWith('proj-1', 'hello\nworld');
    expect(dbInsert).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'proj-1', projectName: 'Alpha', source: 'repeat',
      fileId: 'file-abc', charCount: 11,
    }));
  });

  it('non-verbose: writes the redaction placeholder but keeps real CharCount', async () => {
    mockedIdentity = { projectId: 'proj-1', projectName: 'Alpha' };
    await captureChatSubmit({ source: 'paste', text: 'sensitive stuff', isVerbose: false });
    const [, blobText] = opfsSave.mock.calls[0];
    expect(blobText).toContain('[redacted');
    expect(blobText).not.toContain('sensitive stuff');
    const insertArg = dbInsert.mock.calls[0][0] as { charCount: number };
    expect(insertArg.charCount).toBe('sensitive stuff'.length);
  });

  it('rejects empty / whitespace-only text without touching OPFS or DB', async () => {
    mockedIdentity = { projectId: 'proj-1', projectName: 'Alpha' };
    const r1 = await captureChatSubmit({ source: 'paste', text: '   \n\t  ' });
    expect(r1.isCaptured).toBe(false);
    expect(r1.reason).toBe('empty-text');
    expect(opfsSave).not.toHaveBeenCalled();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('rejects when identity has no projectId — never writes anonymous rows', async () => {
    mockedIdentity = { projectId: null, projectName: 'anything' };
    const r = await captureChatSubmit({ source: 'paste', text: 'x' });
    expect(r.isCaptured).toBe(false);
    expect(r.reason).toBe('no-project-id');
    expect(opfsSave).not.toHaveBeenCalled();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('surfaces OPFS failure via reason=opfs-save-failed and never inserts a DB row', async () => {
    mockedIdentity = { projectId: 'p', projectName: null };
    opfsSave.mockResolvedValueOnce(null);
    const r = await captureChatSubmit({ source: 'next-chip', text: 'x', isVerbose: true });
    expect(r.isCaptured).toBe(false);
    expect(r.reason).toBe('opfs-save-failed');
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('surfaces DB failure via reason=db-insert-failed', async () => {
    mockedIdentity = { projectId: 'p', projectName: null };
    dbInsert.mockResolvedValueOnce(false);
    const r = await captureChatSubmit({ source: 'plan-chip', text: 'x', isVerbose: true });
    expect(r.isCaptured).toBe(false);
    expect(r.reason).toBe('db-insert-failed');
    expect(r.fileId).toBe('file-abc'); // orphan OPFS file (rotation enforcer in step 7 sweeps)
  });

  it('truncates OPFS body at 10_000 chars but records the real full length', async () => {
    mockedIdentity = { projectId: 'p', projectName: null };
    const big = 'a'.repeat(12_000);
    await captureChatSubmit({ source: 'paste', text: big, isVerbose: true });
    const [, blobText] = opfsSave.mock.calls[0];
    expect(blobText.length).toBe(10_000);
    const insertArg = dbInsert.mock.calls[0][0] as { charCount: number };
    expect(insertArg.charCount).toBe(12_000);
  });

  it('passes metaJson through to the DB row when provided', async () => {
    mockedIdentity = { projectId: 'p', projectName: null };
    await captureChatSubmit({ source: 'repeat', text: 'x', metaJson: '{"iteration":3}' });
    const insertArg = dbInsert.mock.calls[0][0] as { metaJson: string | null };
    expect(insertArg.metaJson).toBe('{"iteration":3}');
  });
});
