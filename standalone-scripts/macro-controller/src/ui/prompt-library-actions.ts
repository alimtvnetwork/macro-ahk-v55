const ERROR_CONTEXT_AUTOCATCH = "AutoCatch", ERROR_MSG_UNHANDLED = "Unhandled exception";
import { ServiceResult } from '../utils/result-wrapper';
import { logError } from '../error-utils';
import { log } from '../logger';
import { showToast } from '../toast';
import { setDefaultPromptForRole, deletePromptById, upsertPrompt, type PromptRow } from '../db/prompt-db';
import { getSeedBodyForSlug } from '../seed/plan-next-prompts';
import { ModalRefs, LOG_SCOPE, TOAST_ERROR } from './prompt-library-types';

export async function handleSetDefault(
  refs: ModalRefs,
  row: PromptRow,
  renderAllRoles: (r: ModalRefs) => Promise<void>,
): Promise<void> {
  refs.status.textContent = 'Setting default...';
  try {
    const ok = await setDefaultPromptForRole(row.Id, row.Role);
    if (!ok) {
      refs.status.textContent = 'Failed to set default.';

      return;
    }

    refs.status.textContent = 'Default updated.';
    await renderAllRoles(refs);
  } catch (err) {
    logError(LOG_SCOPE, 'handleSetDefault threw', err);
    refs.status.textContent = 'Failed to set default. See console.';
  }
}

export async function handleDelete(
  refs: ModalRefs,
  row: PromptRow,
  renderAllRoles: (r: ModalRefs) => Promise<void>,
): Promise<void> {
  if (row.IsDefault) {
    alert('Cannot delete the default prompt for this role. Set another prompt as default first.');

    return;
  }

  const ok = window.confirm('Delete prompt "' + row.Name + '"?');
  if (!ok) {
    return;
  }

  refs.status.textContent = 'Deleting...';
  try {
    const res = await deletePromptById(row.Id);
    if (res.isFail) {
      const reason = res.error ?? 'unknown';
      const msgText = 'Cannot delete "' + row.Name + '": ' + reason;
      refs.status.textContent = 'Delete blocked: ' + reason;
      logError(LOG_SCOPE, 'delete blocked', res);
      try {
        showToast(msgText, 'error'); 
      } catch (err) {
        logError(LOG_SCOPE, 'error', err);
      }

      try {
        window.alert(msgText); 
      } catch (err) {
        logError(LOG_SCOPE, 'error', err);
      }

      return;
    }

    refs.status.textContent = 'Deleted.';
    try {
      showToast('Deleted prompt "' + row.Slug + '"', 'success'); 
    } catch (err) {
      logError(LOG_SCOPE, 'error', err);
    }

    await renderAllRoles(refs);
    void (async (): Promise<void> => {
      try {
        const loader = await import('./prompt-loader');
        loader.invalidatePromptCache();
        loader.rerenderPromptsDropdown();
      } catch (cacheErr) {
        logError(LOG_SCOPE, 'post-delete cache refresh failed', cacheErr);
      }
    })();
  } catch (err) {
    logError(LOG_SCOPE, 'handleDelete threw', err);
    refs.status.textContent = 'Failed to delete. See console.';
  }
}

export function uniqueDupSlug(baseSlug: string, existing: readonly string[] = []): string {
  const base = baseSlug.endsWith('-copy') || baseSlug.includes('-copy-') ? baseSlug : baseSlug + '-copy';
  if (!existing.includes(base)) {
    return base;
  }

  for (let i = 2; i < 1000; i++) {
    const candidate = baseSlug + '-copy-' + i;
    if (!existing.includes(candidate)) {
      return candidate;
    }
  }

  return baseSlug + '-copy-' + Date.now();
}

export async function handleDuplicate(
  refs: ModalRefs,
  row: PromptRow,
  renderAllRoles: (r: ModalRefs) => Promise<void>,
): Promise<void> {
  refs.status.textContent = 'Duplicating...';
  try {
    const dupSlug = uniqueDupSlug(row.Slug);
    const result = await upsertPrompt({
      slug: dupSlug,
      name: row.Name + ' (copy)',
      body: row.Body,
      role: row.Role,
    });
    if (result.isFail) {
      refs.status.textContent = 'Failed to duplicate: ' + (result.error ?? 'unknown');

      return;
    }

    refs.status.textContent = 'Duplicated.';
    await renderAllRoles(refs);
  } catch (err) {
    logError(LOG_SCOPE, 'handleDuplicate threw', err);
    refs.status.textContent = 'Failed to duplicate. See console.';
  }
}

export async function handleResetToDefault(
  refs: ModalRefs,
  row: PromptRow,
  renderAllRoles: (r: ModalRefs) => Promise<void>,
): Promise<void> {
  const seedBody = getSeedBodyForSlug(row.Slug);
  if (seedBody === null) {
    logError(LOG_SCOPE, 'reset-to-default called for non-seeded slug=' + row.Slug, new Error('no seed body'));
    refs.status.textContent = 'Reset unavailable: ' + row.Slug + ' is not a seeded prompt.';

    return;
  }

  if (seedBody === row.Body) {
    refs.status.textContent = 'Already at default: ' + row.Slug;

    return;
  }

  const ok = window.confirm('Reset "' + row.Name + '" (' + row.Slug + ') to its shipped default body?\n\nThis discards the current edits to the body.');
  if (!ok) {
    return;
  }

  refs.status.textContent = 'Resetting to default: ' + row.Slug + ' ...';
  try {
    const result = await upsertPrompt({
      id: row.Id, slug: row.Slug,
      name: row.Name, body: seedBody, role: row.Role,
      replaceKey: row.ReplaceKey, replaceValues: row.ReplaceValues,
      previousBody: row.Body, previousReplaceKey: row.ReplaceKey,
    });
    if (result.isFail) {
      logError(LOG_SCOPE, 'reset-to-default upsertPrompt failed for slug=' + row.Slug, new Error(result.error ?? 'unknown'));
      refs.status.textContent = 'Reset failed: ' + (result.error ?? 'unknown error');
      showToast('❌ Reset failed for ' + row.Slug, TOAST_ERROR);

      return;
    }

    log('PromptLibraryModal: reset-to-default slug=' + row.Slug, 'info');
    refs.status.textContent = 'Reset to default: ' + row.Slug;
    showToast('↺ Reset to default: ' + row.Name, 'success');
    await renderAllRoles(refs);
  } catch (err) {
    logError(LOG_SCOPE, 'reset-to-default threw for slug=' + row.Slug, err);
    refs.status.textContent = 'Reset failed: ' + String(err);
    showToast('❌ Reset failed for ' + row.Slug, TOAST_ERROR);
  }
}
