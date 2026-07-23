/**
 * Plan-13 redaction path — cross-layer integration test.
 *
 * Root cause covered: the unit test in `chat-submit-capture.test.ts` proves
 * `bodyForDisk()` writes the redaction placeholder when `isVerbose=false`,
 * but nothing verified that the placeholder actually round-trips through
 * the OPFS `readEntry()` reader that the history panel uses to hydrate
 * body text. This test wires the real capture pipeline against an
 * in-memory implementation of the OPFS store + SQLite DB so a regression
 * in either module (or a future "fallback" that silently unmasks) would
 * be caught here rather than in production.
 *
 * Contract asserted:
 *  1. verbose=false → readEntry() returns the `[redacted ...]` placeholder,
 *     never any substring of the sensitive input.
 *  2. verbose=false → DB row `CharCount` still reflects the true input
 *     length (analytics stay honest per capture doc comment).
 *  3. verbose=true  → readEntry() returns the full input.
 *  4. Toggling verbose between two captures produces two distinct blobs;
 *     the redacted blob never leaks into the verbose file.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/* -------- in-memory OPFS + DB fakes (behave like the real modules) -------- */

interface OpfsBackingStore {
  files: Map<string, string>; // key = `${projectId}/${fileId}`
}
interface DbBackingStore {
  rows: Array<{ Id: number; ProjectId: string; FileId: string; CharCount: number }>;
  nextId: number;
}

const opfs: OpfsBackingStore = { files: new Map() };
const db: DbBackingStore = { rows: [], nextId: 1 };

let fileCounter = 0;

vi.mock('../../storage/chat-submit-opfs-store', () => ({
  saveEntry: async (projectId: string, text: string): Promise<string | null> => {
    fileCounter += 1;
    const fileId = `file-${fileCounter}`;
    opfs.files.set(`${projectId}/${fileId}`, text);
    return fileId;
  },
  readEntry: async (projectId: string, fileId: string): Promise<string | null> => {
    return opfs.files.get(`${projectId}/${fileId}`) ?? null;
  },
}));

vi.mock('../../db/project-chat-submit-db', () => ({
  insertChatSubmit: async (input: { projectId: string; fileId: string; charCount: number }): Promise<boolean> => {
    db.rows.push({
      Id: db.nextId++,
      ProjectId: input.projectId,
      FileId: input.fileId,
      CharCount: input.charCount,
    });
    return true;
  },
}));

vi.mock('../../util/project-id-from-url', () => ({
  resolveProjectIdentity: () => ({ projectId: 'proj-red', projectName: 'RedactionSpec' }),
  subscribeProjectNameChange: () => () => {},
  notifyIfProjectRenamed: () => {},
  extractProjectIdFromString: () => null,
}));

vi.mock('../chat-submit-window', () => ({
  enforceChatSubmitWindow: async () => 0,
}));

vi.mock('../chat-submit-rename-backfill', () => ({
  installChatSubmitRenameBackfill: () => {},
  notifyIfProjectRenamed: () => {},
}));

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
  return { ...actual, logError: vi.fn() };
});

import { captureChatSubmit } from '../chat-submit-capture';
import { readEntry } from '../../storage/chat-submit-opfs-store';

const SENSITIVE = 'API_KEY=sk-live-42-DO-NOT-LEAK password=hunter2';

beforeEach(() => {
  opfs.files.clear();
  db.rows = [];
  db.nextId = 1;
  fileCounter = 0;
});

describe('Plan-13 redaction path (capture → OPFS → readEntry)', () => {
  it('verbose=false persists ONLY the redaction placeholder in the OPFS body', async () => {
    const result = await captureChatSubmit({ source: 'paste', text: SENSITIVE, isVerbose: false });
    expect(result.isCaptured).toBe(true);
    expect(result.fileId).not.toBeNull();

    const body = await readEntry('proj-red', result.fileId!);
    expect(body).toBeTruthy();
    expect(body).toContain('[redacted');
    // Belt-and-braces: no substring of the sensitive payload survives.
    expect(body).not.toContain('sk-live-42');
    expect(body).not.toContain('hunter2');
    expect(body).not.toContain('API_KEY');
  });

  it('verbose=false still records the true CharCount in the DB row', async () => {
    await captureChatSubmit({ source: 'paste', text: SENSITIVE, isVerbose: false });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].CharCount).toBe(SENSITIVE.length);
  });

  it('verbose=true persists the full input verbatim', async () => {
    const result = await captureChatSubmit({ source: 'paste', text: SENSITIVE, isVerbose: true });
    const body = await readEntry('proj-red', result.fileId!);
    expect(body).toBe(SENSITIVE);
    expect(body).not.toContain('[redacted');
  });

  it('mixed verbose flags across captures never cross-contaminate blobs', async () => {
    const r1 = await captureChatSubmit({ source: 'paste', text: SENSITIVE, isVerbose: false });
    const r2 = await captureChatSubmit({ source: 'paste', text: SENSITIVE, isVerbose: true });

    const b1 = await readEntry('proj-red', r1.fileId!);
    const b2 = await readEntry('proj-red', r2.fileId!);

    expect(b1).toContain('[redacted');
    expect(b1).not.toContain('sk-live-42');
    expect(b2).toBe(SENSITIVE);
    expect(r1.fileId).not.toBe(r2.fileId);
  });
});
