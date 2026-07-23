/**
 * Chat Submit Rename Backfill — plan 13 step 8.
 *
 * Wires `subscribeProjectNameChange` (step 5) to
 * `renameProjectChatSubmits` (step 4) so a renamed Lovable project
 * back-fills `ProjectChatSubmit.ProjectName` across every historical
 * row for that projectId.
 *
 * Install is idempotent — the module keeps a single global
 * subscription across the tab lifetime. `captureChatSubmit` calls
 * `installChatSubmitRenameBackfill()` + `notifyIfProjectRenamed()`
 * on every submit so rename detection runs at the natural cadence of
 * user activity without a polling timer.
 *
 * All failures route through `logError('ChatSubmitRenameBackfill', ...)`.
 * A failed `renameProjectChatSubmits` is logged; retry on the next
 * capture is not automatic (the map already advanced), so a
 * best-effort backfill is by design — matches the no-retry policy.
 */

import { logError } from '../error-utils';
import { renameProjectChatSubmits } from '../db/project-chat-submit-db';
import { subscribeProjectNameChange, notifyIfProjectRenamed } from '../util/project-id-from-url';

const SCOPE = 'ChatSubmitRenameBackfill';

let isInstalled = false;
let unsubscribe: (() => void) | null = null;

async function handleRename(projectId: string, oldName: string | null, newName: string | null): Promise<void> {
  if (!newName) {
    // A rename *to* null is meaningless for backfill (no better label
    // to persist). Log for visibility and skip — never overwrite a
    // known name with null.
    logError(SCOPE, `skip: newName is null (projectId=${projectId}, oldName=${oldName ?? 'null'})`);
    return;
  }
  const isRenamed = await renameProjectChatSubmits(projectId, newName);
  if (!isRenamed) {
    logError(SCOPE, `renameProjectChatSubmits failed (projectId=${projectId}, oldName=${oldName ?? 'null'}, newName=${newName})`);
  }
}

export function installChatSubmitRenameBackfill(): void {
  if (isInstalled) return;
  isInstalled = true;
  unsubscribe = subscribeProjectNameChange((projectId, oldName, newName) => {
    void handleRename(projectId, oldName, newName);
  });
}

/** Test helper — tear down the singleton subscription between specs. */
export function _resetChatSubmitRenameBackfillForTests(): void {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  isInstalled = false;
}

/** Convenience re-export so the capture path has one import. */
export { notifyIfProjectRenamed };
