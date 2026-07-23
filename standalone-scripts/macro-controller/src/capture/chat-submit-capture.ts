/**
 * Chat Submit Capture — plan 13 step 6.
 *
 * Single call site for every capture hook (paste, repeat, next, plan).
 * Combines the plan-13 primitives that landed in earlier steps:
 *
 *   step 3 → OPFS blob store        (`storage/chat-submit-opfs-store.ts`)
 *   step 4 → SQLite metadata table  (`db/project-chat-submit-db.ts`)
 *   step 5 → identity façade        (`util/project-id-from-url.ts`)
 *
 * Verbose gate: `verboseLogging` (per-project, see
 * mem://standards/verbose-logging-and-failure-diagnostics) controls
 * whether the full submission text is written to disk. When OFF the
 * OPFS file contains a `[redacted]` placeholder — the metadata row +
 * `CharCount` are always written so downstream analytics stay honest.
 *
 * All hard failures route through `logError('ChatSubmitCapture', ...)`.
 * A missing projectId, empty text, or step-3/step-4 write failure is
 * logged and returned; callers use fire-and-forget `void capture(...)`.
 */

import { logError } from '../error-utils';
import { saveEntry } from '../storage/chat-submit-opfs-store';
import { insertChatSubmit, type ChatSubmitSource } from '../db/project-chat-submit-db';
import { resolveProjectIdentity } from '../util/project-id-from-url';
import { enforceChatSubmitWindow } from './chat-submit-window';
import { installChatSubmitRenameBackfill, notifyIfProjectRenamed } from './chat-submit-rename-backfill';

const SCOPE = 'ChatSubmitCapture';
const REDACTED_PLACEHOLDER = '[redacted — enable verbose logging to capture full text]';
const MAX_TEXT_CHARS = 10_000;

export interface CaptureChatSubmitInput {
  source: ChatSubmitSource;
  text: string;
  metaJson?: string | null;
  isVerbose?: boolean;
}

export interface CaptureChatSubmitResult {
  isCaptured: boolean;
  projectId: string | null;
  fileId: string | null;
  reason?: string;
}

function truncateForOpfs(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text;
  return text.slice(0, MAX_TEXT_CHARS);
}

function bodyForDisk(text: string, isVerbose: boolean): string {
  if (!isVerbose) return REDACTED_PLACEHOLDER;
  return truncateForOpfs(text);
}

async function persistCapture(
  projectId: string,
  projectName: string | null,
  source: ChatSubmitSource,
  text: string,
  metaJson: string | null,
  isVerbose: boolean,
): Promise<CaptureChatSubmitResult> {
  const fileId = await saveEntry(projectId, bodyForDisk(text, isVerbose));
  if (!fileId) {
    return { isCaptured: false, projectId, fileId: null, reason: 'opfs-save-failed' };
  }
  const isRowInserted = await insertChatSubmit({
    projectId, projectName, source, fileId,
    charCount: text.length, createdAt: Date.now(), metaJson,
  });
  if (!isRowInserted) {
    return { isCaptured: false, projectId, fileId, reason: 'db-insert-failed' };
  }
  // Fire-and-forget: enforcer failures are logged internally and must
  // not fail the capture — the row is already persisted.
  void enforceChatSubmitWindow(projectId).catch((err) => {
    logError(SCOPE, `enforceChatSubmitWindow threw (projectId=${projectId})`, err);
  });
  return { isCaptured: true, projectId, fileId };
}

export async function captureChatSubmit(input: CaptureChatSubmitInput): Promise<CaptureChatSubmitResult> {
  const trimmed = (input.text || '').replace(/^\s+|\s+$/g, '');
  if (trimmed.length === 0) {
    return { isCaptured: false, projectId: null, fileId: null, reason: 'empty-text' };
  }
  // Install rename backfill once + poll rename detection on every capture.
  // Cheap: install is idempotent; notify is a pure map lookup.
  installChatSubmitRenameBackfill();
  notifyIfProjectRenamed();
  const { projectId, projectName } = resolveProjectIdentity();
  if (!projectId) {
    logError(SCOPE, `captureChatSubmit: no projectId (source=${input.source}, chars=${trimmed.length})`);
    return { isCaptured: false, projectId: null, fileId: null, reason: 'no-project-id' };
  }
  const isVerbose = input.isVerbose === true;
  const metaJson = input.metaJson ?? null;
  return persistCapture(projectId, projectName, input.source, trimmed, metaJson, isVerbose);
}
