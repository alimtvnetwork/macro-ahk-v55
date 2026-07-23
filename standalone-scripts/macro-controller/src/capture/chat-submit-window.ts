/**
 * Chat Submit Rolling Window Enforcer — plan 13 step 7.
 *
 * Keeps `ProjectChatSubmit` bounded to a per-project cap by pruning the
 * oldest rows (SQLite) and their sidecar OPFS blobs. Runs after every
 * successful insert in `captureChatSubmit`.
 *
 * Cap resolution order:
 *   1. explicit override argument (tests, admin tools)
 *   2. `Project.ChatSubmitCap` in chrome.storage.local (per-project)
 *   3. `DEFAULT_CHAT_SUBMIT_CAP` (= 300)
 *
 * All prune failures route through `logError('ChatSubmitWindow', ...)`.
 * A partial prune (some rows deleted, some failed) is reported honestly
 * via `EnforceWindowResult.prunedCount` + `EnforceWindowResult.failedCount`.
 * Never throws: callers use fire-and-forget.
 */

import { logError } from '../error-utils';
import {
  countChatSubmits,
  deleteChatSubmit,
  listOldestChatSubmits,
} from '../db/project-chat-submit-db';
import { deleteEntry as deleteOpfsEntry } from '../storage/chat-submit-opfs-store';

const SCOPE = 'ChatSubmitWindow';

export const DEFAULT_CHAT_SUBMIT_CAP = 300;
export const MIN_CHAT_SUBMIT_CAP = 10;
export const MAX_CHAT_SUBMIT_CAP = 5_000;
const CAP_STORAGE_PREFIX = 'Project.ChatSubmitCap.';

export interface EnforceWindowResult {
  cap: number;
  countBefore: number;
  prunedCount: number;
  failedCount: number;
}

export function clampCap(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CHAT_SUBMIT_CAP;
  const floored = Math.floor(value);
  if (floored < MIN_CHAT_SUBMIT_CAP) return MIN_CHAT_SUBMIT_CAP;
  if (floored > MAX_CHAT_SUBMIT_CAP) return MAX_CHAT_SUBMIT_CAP;
  return floored;
}

async function readCapFromStorage(projectId: string): Promise<number | null> {
  try {
    const chromeApi = (globalThis as { chrome?: { storage?: { local?: { get?: (k: string) => Promise<Record<string, unknown>> } } } }).chrome;
    const get = chromeApi?.storage?.local?.get;
    if (typeof get !== 'function') return null;
    const key = `${CAP_STORAGE_PREFIX}${projectId}`;
    const bag = await get.call(chromeApi!.storage!.local, key);
    const raw = bag?.[key];
    if (typeof raw !== 'number') return null;
    return clampCap(raw);
  } catch (err) {
    logError(SCOPE, `readCapFromStorage failed (projectId=${projectId})`, err);
    return null;
  }
}

export async function resolveCap(projectId: string, override?: number): Promise<number> {
  if (typeof override === 'number') return clampCap(override);
  const stored = await readCapFromStorage(projectId);
  if (stored !== null) return stored;
  return DEFAULT_CHAT_SUBMIT_CAP;
}

export async function enforceChatSubmitWindow(
  projectId: string,
  override?: number,
): Promise<EnforceWindowResult> {
  const cap = await resolveCap(projectId, override);
  const countBefore = await countChatSubmits(projectId);
  if (countBefore <= cap) {
    return { cap, countBefore, prunedCount: 0, failedCount: 0 };
  }
  const excess = countBefore - cap;
  const victims = await listOldestChatSubmits(projectId, excess);
  let pruned = 0;
  let failed = 0;
  for (const row of victims) {
    // Delete OPFS first — an orphan blob is worse than an orphan row
    // (the row can be re-linked by FileId; a blob has no back-pointer).
    const isOpfsGone = await deleteOpfsEntry(projectId, row.FileId);
    if (!isOpfsGone) {
      failed += 1;
      continue;
    }
    const isRowGone = await deleteChatSubmit(row.Id);
    if (isRowGone) pruned += 1;
    else failed += 1;
  }
  return { cap, countBefore, prunedCount: pruned, failedCount: failed };
}
