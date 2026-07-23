/**
 * MacroController - Chat Submit OPFS Store
 *
 * Origin Private File System (OPFS) backed store for per-project chat
 * submissions. Keeps SQLite lean by holding only metadata rows in the
 * DB and writing the raw submission text to disk as UTF-8 `.txt` files.
 *
 * Layout: `chat-submits/<projectId>/<fileId>.txt`
 *
 * Plan 13, step 3. See `.lovable/plans/pending/13-per-project-chat-submit-tracker.md`.
 *
 * All hard errors go through `logError` (namespace logger). Silent
 * catches are forbidden per project error-management policy.
 */

import { logError, toErrorMessage } from '../error-utils';

const SCOPE = 'ChatSubmitOpfsStore';
const ROOT_DIR = 'chat-submits';
const FILE_EXT = '.txt';

export type ChatSubmitFileId = string;

interface OpfsUnavailableReason {
  isAvailable: false;
  reason: string;
}
interface OpfsAvailableRoot {
  isAvailable: true;
  root: FileSystemDirectoryHandle;
}
export type OpfsRootResult = OpfsUnavailableReason | OpfsAvailableRoot;

async function resolveRoot(): Promise<OpfsRootResult> {
  const hasStorage = typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
  if (!hasStorage) return { isAvailable: false, reason: 'navigator.storage.getDirectory unavailable' };
  try {
    const root = await navigator.storage.getDirectory();
    return { isAvailable: true, root };
  } catch (e) {
    return { isAvailable: false, reason: toErrorMessage(e) };
  }
}

async function getProjectDir(projectId: string, isCreate: boolean): Promise<FileSystemDirectoryHandle | null> {
  const rootResult = await resolveRoot();
  if (!rootResult.isAvailable) {
    logError(SCOPE, `OPFS root unavailable (projectId=${projectId}): ${rootResult.reason}`);
    return null;
  }
  const base = await rootResult.root.getDirectoryHandle(ROOT_DIR, { create: isCreate });
  return base.getDirectoryHandle(projectId, { create: isCreate });
}

function generateFileId(): ChatSubmitFileId {
  const hasRandomUuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
  if (hasRandomUuid) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveEntry(projectId: string, text: string): Promise<ChatSubmitFileId | null> {
  try {
    const dir = await getProjectDir(projectId, true);
    if (!dir) return null;
    const fileId = generateFileId();
    const handle = await dir.getFileHandle(`${fileId}${FILE_EXT}`, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return fileId;
  } catch (e) {
    logError(SCOPE, `saveEntry failed (projectId=${projectId}, chars=${text.length})`, e);
    return null;
  }
}

export async function readEntry(projectId: string, fileId: ChatSubmitFileId): Promise<string | null> {
  try {
    const dir = await getProjectDir(projectId, false);
    if (!dir) return null;
    const handle = await dir.getFileHandle(`${fileId}${FILE_EXT}`, { create: false });
    const file = await handle.getFile();
    return await file.text();
  } catch (e) {
    logError(SCOPE, `readEntry failed (projectId=${projectId}, fileId=${fileId})`, e);
    return null;
  }
}

export async function deleteEntry(projectId: string, fileId: ChatSubmitFileId): Promise<boolean> {
  try {
    const dir = await getProjectDir(projectId, false);
    if (!dir) return false;
    await dir.removeEntry(`${fileId}${FILE_EXT}`);
    return true;
  } catch (e) {
    logError(SCOPE, `deleteEntry failed (projectId=${projectId}, fileId=${fileId})`, e);
    return false;
  }
}

async function collectFileIds(dir: FileSystemDirectoryHandle): Promise<ChatSubmitFileId[]> {
  const ids: ChatSubmitFileId[] = [];
  const iterable = dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
  for await (const [name, handle] of iterable) {
    const isTxtFile = handle.kind === 'file' && name.endsWith(FILE_EXT);
    if (isTxtFile) ids.push(name.slice(0, -FILE_EXT.length));
  }
  return ids;
}

export async function listProject(projectId: string): Promise<ChatSubmitFileId[]> {
  try {
    const dir = await getProjectDir(projectId, false);
    if (!dir) return [];
    return await collectFileIds(dir);
  } catch (e) {
    logError(SCOPE, `listProject failed (projectId=${projectId})`, e);
    return [];
  }
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const rootResult = await resolveRoot();
  if (!rootResult.isAvailable) {
    logError(SCOPE, `deleteProject: OPFS unavailable (projectId=${projectId}): ${rootResult.reason}`);
    return false;
  }
  try {
    const base = await rootResult.root.getDirectoryHandle(ROOT_DIR, { create: false });
    await base.removeEntry(projectId, { recursive: true });
    return true;
  } catch (e) {
    logError(SCOPE, `deleteProject failed (projectId=${projectId})`, e);
    return false;
  }
}
