/**
 * Chat Submit OPFS Store — unit tests.
 *
 * Uses an in-memory FileSystemDirectoryHandle stub bound to
 * `navigator.storage.getDirectory()`. Covers happy path (save + read +
 * list + delete + deleteProject) and unavailable-OPFS fallback.
 *
 * Plan 13, step 3.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../error-utils')>('../error-utils');
  return { ...actual, logError: vi.fn() };
});

import {
  saveEntry,
  readEntry,
  listProject,
  deleteEntry,
  deleteProject,
} from '../storage/chat-submit-opfs-store';

interface FakeFile {
  name: string;
  contents: string;
}

class FakeDir {
  public files = new Map<string, FakeFile>();
  public dirs = new Map<string, FakeDir>();
  constructor(public name = 'root') {}

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDir> {
    let child = this.dirs.get(name);
    if (!child) {
      if (!opts?.create) throw new Error(`NotFoundError: ${name}`);
      child = new FakeDir(name);
      this.dirs.set(name, child);
    }
    return child;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }) {
    let file = this.files.get(name);
    if (!file) {
      if (!opts?.create) throw new Error(`NotFoundError: ${name}`);
      file = { name, contents: '' };
      this.files.set(name, file);
    }
    const capture = file;
    return {
      kind: 'file' as const,
      name,
      getFile: async () => ({ text: async () => capture.contents }),
      createWritable: async () => ({
        write: async (data: string) => { capture.contents = data; },
        close: async () => { /* no-op */ },
      }),
    };
  }

  async removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void> {
    if (this.files.delete(name)) return;
    const hadDir = this.dirs.delete(name);
    if (!hadDir) throw new Error(`NotFoundError: ${name}`);
    if (!opts?.recursive && (this.dirs.get(name)?.files.size ?? 0) > 0) {
      throw new Error('InvalidModificationError');
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<[string, { kind: string }]> {
    for (const [n, f] of this.files) yield [n, { kind: 'file', name: f.name }];
    for (const [n] of this.dirs) yield [n, { kind: 'directory' }];
  }
}

function installFakeOpfs(): FakeDir {
  const root = new FakeDir();
  Object.defineProperty(globalThis, 'navigator', {
    value: { storage: { getDirectory: async () => root } },
    configurable: true,
    writable: true,
  });
  return root;
}

function removeOpfs(): void {
  Object.defineProperty(globalThis, 'navigator', {
    value: {},
    configurable: true,
    writable: true,
  });
}

describe('chat-submit-opfs-store', () => {
  const projectId = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    installFakeOpfs();
  });

  it('saves an entry and reads it back', async () => {
    const fileId = await saveEntry(projectId, 'hello world');
    expect(fileId).toBeTruthy();
    const text = await readEntry(projectId, fileId!);
    expect(text).toBe('hello world');
  });

  it('lists all file ids for a project', async () => {
    const a = await saveEntry(projectId, 'a');
    const b = await saveEntry(projectId, 'b');
    const ids = await listProject(projectId);
    expect(ids.sort()).toEqual([a, b].sort());
  });

  it('deletes a single entry', async () => {
    const id = await saveEntry(projectId, 'x');
    const isRemoved = await deleteEntry(projectId, id!);
    expect(isRemoved).toBe(true);
    const ids = await listProject(projectId);
    expect(ids).not.toContain(id);
  });

  it('deletes the whole project directory recursively', async () => {
    await saveEntry(projectId, 'x');
    await saveEntry(projectId, 'y');
    const isRemoved = await deleteProject(projectId);
    expect(isRemoved).toBe(true);
    const ids = await listProject(projectId);
    expect(ids).toEqual([]);
  });

  it('returns null for saveEntry when OPFS is unavailable', async () => {
    removeOpfs();
    const fileId = await saveEntry(projectId, 'no opfs');
    expect(fileId).toBeNull();
  });

  it('returns empty list when project directory does not exist', async () => {
    const ids = await listProject('00000000-0000-0000-0000-000000000000');
    expect(ids).toEqual([]);
  });
});
