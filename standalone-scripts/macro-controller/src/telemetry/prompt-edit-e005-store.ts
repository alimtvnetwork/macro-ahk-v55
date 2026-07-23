/**
 * prompt-edit-e005-store.ts
 *
 * Bounded, role-keyed store of the most recent PROMPT_EDIT_E005 diagnostic
 * snapshots. Every failing path in `prompt-editor.ts` that emits the
 * PROMPT_EDIT_E005 code records the enriched `DiagnosticContext` here so
 * the Seed Diagnostics panel can render a "resolved slug + owning role"
 * summary and produce a downloadable diagnostics ZIP without re-querying
 * the DB.
 *
 * Storage layout (localStorage[StorageKey.PromptEditE005Store]):
 *   { entries: PromptEditE005Entry[] }
 * Bounded to MAX_ENTRIES most-recent records (FIFO eviction).
 */

import { StorageKey } from '../types/storage-keys';
import type { DiagnosticContext } from '../errors/diagnostic-error';
import type { PromptRole } from '../types/prompt-role';
import { logError } from '../error-utils';

export const PROMPT_EDIT_E005_MAX_ENTRIES = 20;

export interface PromptEditE005Entry {
  /** ISO UTC timestamp; render local at display time. */
  at: string;
  role: PromptRole;
  /** Snapshot fields from `buildRoleDiagnosticSnapshot` + site/reason merges. */
  context: DiagnosticContext;
  /** Optional cause message (never the raw error object). */
  causeMessage?: string;
}

interface Envelope { entries: PromptEditE005Entry[]; }

function safeRead(): Envelope {
  try {
    const raw = localStorage.getItem(StorageKey.PromptEditE005Store);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw) as Envelope;
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    return parsed;
  } catch (err) {
    logError('PromptEditE005Store', 'read failed', err);
    return { entries: [] };
  }
}

function safeWrite(env: Envelope): void {
  try {
    localStorage.setItem(StorageKey.PromptEditE005Store, JSON.stringify(env));
  } catch (err) {
    logError('PromptEditE005Store', 'write failed', err);
  }
}

export function recordPromptEditE005(
  role: PromptRole,
  context: DiagnosticContext,
  cause?: unknown,
): void {
  const env = safeRead();
  const entry: PromptEditE005Entry = {
    at: new Date().toISOString(),
    role,
    context,
  };
  if (cause !== undefined) {
    entry.causeMessage = cause instanceof Error ? cause.message : String(cause);
  }
  env.entries.push(entry);
  if (env.entries.length > PROMPT_EDIT_E005_MAX_ENTRIES) {
    env.entries = env.entries.slice(-PROMPT_EDIT_E005_MAX_ENTRIES);
  }
  safeWrite(env);
}

export function readPromptEditE005Entries(): PromptEditE005Entry[] {
  return safeRead().entries;
}

export function readLatestPromptEditE005ByRole(): Record<string, PromptEditE005Entry> {
  const byRole: Record<string, PromptEditE005Entry> = {};
  for (const entry of safeRead().entries) {
    byRole[entry.role] = entry;
  }
  return byRole;
}

export function clearPromptEditE005Entries(): void {
  try {
    localStorage.removeItem(StorageKey.PromptEditE005Store);
  } catch (err) {
    logError('PromptEditE005Store', 'clear failed', err);
  }
}

export interface PromptEditE005Summary {
  role: PromptRole | string;
  resolvedSlug: string;
  slugOwnerRole: string;
  orphanRoleMismatch: string;
  site: string;
  reason: string;
  at: string;
}

/** Short one-line summary per role for the diagnostics panel header. */
export function summarizeLatestByRole(): PromptEditE005Summary[] {
  const latest = readLatestPromptEditE005ByRole();
  const out: PromptEditE005Summary[] = [];
  for (const role of Object.keys(latest)) {
    const entry = latest[role];
    if (!entry) continue;
    const context = entry.context;
    out.push({
      role: entry.role,
      resolvedSlug: String(context['resolvedSlug'] ?? '(unknown)'),
      slugOwnerRole: String(context['slugOwnerRole'] ?? '(unknown)'),
      orphanRoleMismatch: String(context['orphanRoleMismatch'] ?? '(unknown)'),
      site: String(context['site'] ?? '(unknown)'),
      reason: String(context['reason'] ?? ''),
      at: entry.at,
    });
  }
  return out;
}
