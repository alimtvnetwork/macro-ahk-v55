/**
 * Project ID + name extractor — plan 13, step 5.
 *
 * Single canonical entry point for chat-submit capture hooks (paste,
 * repeat, next, plan) to learn *which* project the current submission
 * belongs to and *what* human-readable name to stamp on the row.
 *
 * Delegates to existing implementations to avoid drift:
 *   - `extractProjectIdFromUrl()` from `workspace-detection.ts` (already
 *     memoized per-href and handles preview subdomains).
 *   - `getDisplayProjectName()` from `logging.ts` (already prioritizes
 *     API name → DOM XPath → document.title → UUID fallback).
 *
 * Adds two pieces the capture pipeline needs but no one owned yet:
 *   1. `resolveProjectIdentity()` — combines id + name in one shot.
 *   2. `subscribeProjectNameChange(callback)` — fires when the *displayed*
 *      name of a known projectId changes, so step 8 (rename backfill)
 *      can `UPDATE ProjectChatSubmit SET ProjectName=?`.
 *
 * The plan-mandated regex `/\/projects\/([0-9a-f-]{36})/i` is exposed
 * as `LOVABLE_PROJECT_ID_REGEX` for callers that need a pure string
 * match (e.g. logging middleware) without touching `window.location`.
 */

import { extractProjectIdFromUrl } from '../workspace-detection';
import { getDisplayProjectName } from '../logger';
import { logError } from '../error-utils';

const SCOPE = 'ProjectIdentity';

export const LOVABLE_PROJECT_ID_REGEX = /\/projects\/([0-9a-f-]{36})/i;

export interface ProjectIdentity {
  projectId: string | null;
  projectName: string | null;
}

/** Pure-string variant. No DOM, no memoization. */
export function extractProjectIdFromString(url: string): string | null {
  const match = url.match(LOVABLE_PROJECT_ID_REGEX);
  return match ? match[1] : null;
}

/** Combined identity for capture hooks. */
export function resolveProjectIdentity(): ProjectIdentity {
  try {
    return {
      projectId: extractProjectIdFromUrl(),
      projectName: getDisplayProjectName() || null,
    };
  } catch (e) {
    logError(SCOPE, 'resolveProjectIdentity failed', e);
    return { projectId: null, projectName: null };
  }
}

// ── Rename detection ────────────────────────────────────────────────

export type ProjectNameChangeListener = (projectId: string, oldName: string | null, newName: string | null) => void;

const listeners = new Set<ProjectNameChangeListener>();
const lastKnownName = new Map<string, string | null>();

export function subscribeProjectNameChange(callback: ProjectNameChangeListener): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

/** Explicit poll hook — call after project navigation or name-refresh events. */
export function notifyIfProjectRenamed(): void {
  const { projectId, projectName } = resolveProjectIdentity();
  if (!projectId) return;
  const isFirstSeen = !lastKnownName.has(projectId);
  if (isFirstSeen) { lastKnownName.set(projectId, projectName); return; }
  const prev = lastKnownName.get(projectId) ?? null;
  if (prev === projectName) return;
  lastKnownName.set(projectId, projectName);
  fireListeners(projectId, prev, projectName);
}

function fireListeners(projectId: string, prev: string | null, next: string | null): void {
  for (const callback of listeners) {
    try { callback(projectId, prev, next); }
    catch (e) { logError(SCOPE, `listener threw for projectId=${projectId}`, e); }
  }
}

/** Test helper — reset internal state so specs don't leak across cases. */
export function _resetProjectIdentityStateForTests(): void {
  listeners.clear();
  lastKnownName.clear();
}
