const ERROR_CONTEXT_AUTOCATCH = "AutoCatch", ERROR_MSG_UNHANDLED = "Unhandled exception";
import { log } from '../logger';
import { showToast } from '../toast';
import { exportPromptsToJson, parsePromptsText, performPromptImport } from './prompt-io';
import { buildFriendlyImportError } from './prompt-import-error-message';
import { renderImportErrorBanner, clearImportErrorBanner, logLibraryImportFailure, extractImportErrorReason, focusErrorBanner } from './prompt-library-error';
import { renderPartialImportErrors, clearPartialImportErrors, showImportProgress, hideImportProgress, updateImportProgress } from './prompt-library-progress';
import { validateImportFile } from './prompt-library-preview';
import { ModalRefs, LOG_SCOPE, IMPORT_FAILED_PREFIX, TOAST_ERROR } from './prompt-library-types';
import { logError } from '../error-utils';
import { PreviewTriggerType } from "../types/enums";

export function ensureSpinnerStyle(doc: Document): void {
  if (doc.getElementById('mc-spinner-style')) return;
  const style = doc.createElement('style');
  style.id = 'mc-spinner-style';
  style.textContent = '@keyframes mc-spin{to{transform:rotate(360deg)}}';
  doc.head.appendChild(style);
}

export function showImportSpinner(importBtn: HTMLButtonElement): void {
  ensureSpinnerStyle(importBtn.ownerDocument);
  importBtn.textContent = '';
  const spinner = importBtn.ownerDocument.createElement('span');
  spinner.dataset.testid = 'library-import-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  spinner.style.cssText = [
    'display:inline-block', 'width:10px', 'height:10px', 'border:2px solid #9aa7bd',
    'border-top-color:transparent', 'border-radius:50%', 'margin-right:6px',
    'vertical-align:-1px', 'animation:mc-spin 0.7s linear infinite',
  ].join(';');
  importBtn.appendChild(spinner);
  importBtn.appendChild(importBtn.ownerDocument.createTextNode('Importing...'));
}

export function hideImportSpinner(importBtn: HTMLButtonElement, originalLabel: string): void {
  importBtn.textContent = originalLabel;
}

export function restoreFocusToImportButton(refs: ModalRefs): void {
  const isMissingIsConnected = !refs.root.isConnected;
  if (isMissingIsConnected) return;
  const btn = refs.root.querySelector<HTMLButtonElement>('[data-testid="library-import"]');
  if (btn) btn.focus();
}

export async function handleExport(refs: ModalRefs): Promise<void> {
  refs.status.textContent = 'Exporting ...';
  try {
    const includeRevisions = refs.includeRevisionsCb?.checked === true;
    await exportPromptsToJson({ includeRevisions });
    refs.status.textContent = 'Export complete.';
    log('PromptLibraryModal: export completed', 'info');
  } catch (err) {
    logError(LOG_SCOPE, 'export threw', err);
    refs.status.textContent = 'Export failed. See console.';
    showToast('Export failed', TOAST_ERROR);
  }
}

async function executeImportParse(
  refs: ModalRefs,
  text: string,
  file: File
) {
  const parsed = parsePromptsText(text);
  if (parsed.errors.length > 0 && parsed.valid.length === 0) {
    const friendly = buildFriendlyImportError(parsed.errors, file.name);
    refs.status.textContent = 'Import parse failed: ' + friendly.headline;
    renderImportErrorBanner(refs, friendly.headline, friendly.hint);
    logLibraryImportFailure('parse', 'errors=' + String(parsed.errors.length) + ' name=' + file.name, parsed.errors);
    showToast(IMPORT_FAILED_PREFIX + friendly.headline, TOAST_ERROR);
    refs.lastImportFailed = true;

    return null;
  }

  return parsed;
}

async function executeImportDb(
  refs: ModalRefs,
  parsed: ReturnType<typeof parsePromptsText>,
  renderAllRoles: (r: ModalRefs) => Promise<void>
) {
  const roleSel = refs.importRoleSelect?.value;
  const roleFilter = (roleSel === 'plan' || roleSel === 'next' || roleSel === 'generic') ? roleSel : undefined;
  const importOpts: Parameters<typeof performPromptImport>[1] = { overwrite: true };
  if (roleFilter) importOpts.roleFilter = roleFilter;
  if (parsed.revisions && parsed.revisions.length > 0) importOpts.revisions = parsed.revisions;
  if (parsed.promptOrder && parsed.promptOrder.length > 0) importOpts.promptOrder = parsed.promptOrder;
  
  showImportProgress(refs);
  importOpts.onProgress = (p) => updateImportProgress(refs, p);
  
  const results = await performPromptImport(parsed.valid, importOpts);
  const skipped = parsed.errors.length;
  const revBit = (results.revisionsImported ?? 0) > 0 ? ', +' + String(results.revisionsImported) + ' revisions' : '';
  const summary = 'Import: +' + results.added + ' added, ' + results.updated
    + ' updated' + revBit + (skipped > 0 ? ', ' + skipped + ' skipped' : '')
    + (results.errors.length > 0 ? ', ' + results.errors.length + ' errors' : '');
    
  log('PromptLibraryModal: ' + summary, 'info');
  showToast(summary, results.errors.length > 0 ? 'warn' : 'success');
  await renderAllRoles(refs);
  
  return { summary, results };
}

export async function handleImportFile(
  refs: ModalRefs,
  file: File,
  fileInput: HTMLInputElement,
  importBtn: HTMLButtonElement,
  renderAllRoles: (r: ModalRefs) => Promise<void>,
  origin: PreviewTriggerType = 'click',
): Promise<void> {
  if (importBtn.disabled) return;
  const retrying = refs.lastImportFailed === true;
  const attemptPrefix = retrying ? 'Retrying import: ' : 'Importing ';
  const retry = (): void => { void handleImportFile(refs, file, fileInput, importBtn, renderAllRoles, 'click'); };
  
  const invalid = validateImportFile(file);
  if (invalid) {
    refs.status.textContent = (retrying ? 'Retry rejected: ' : 'Import rejected: ') + invalid.headline;
    renderImportErrorBanner(refs, invalid.headline, invalid.hint);
    logLibraryImportFailure('validation', 'name=' + file.name + ' size=' + String(file.size) + ' type=' + file.type + ' headline=' + invalid.headline);
    showToast(IMPORT_FAILED_PREFIX + invalid.headline, TOAST_ERROR);
    refs.lastImportFailed = true;
    try { fileInput.value = ''; } catch (err) {
      logError(ERROR_CONTEXT_AUTOCATCH, ERROR_MSG_UNHANDLED, err);
    }
    focusErrorBanner(refs);

    return;
  }
  
  importBtn.disabled = true;
  importBtn.setAttribute('aria-busy', 'true');
  fileInput.disabled = true;
  const originalLabel = importBtn.textContent ?? 'Import';
  showImportSpinner(importBtn);
  clearImportErrorBanner(refs);
  clearPartialImportErrors(refs);

  refs.status.textContent = attemptPrefix + file.name + ' ...';
  let focusAfter: 'import' | 'banner' | null = null;
  
  try {
    const text = await file.text();
    const parsed = await executeImportParse(refs, text, file);
    const isMissingParsed = !parsed;
    if (isMissingParsed) {
      focusAfter = 'banner';

      return;
    }

    const { summary, results } = await executeImportDb(refs, parsed, renderAllRoles);

    refs.status.textContent = (retrying ? 'Retry succeeded. ' : '') + summary;
    refs.lastImportFailed = false;
    clearImportErrorBanner(refs);
    renderPartialImportErrors(refs, results.errors, parsed.errors);
    if (origin === 'drop') focusAfter = 'import';
  } catch (err) {
    logError(ERROR_CONTEXT_AUTOCATCH, ERROR_MSG_UNHANDLED, err);
    logLibraryImportFailure('thrown', 'threw during read/parse for name=' + file.name, err);
    const reason = extractImportErrorReason(err);
    refs.status.textContent = IMPORT_FAILED_PREFIX + reason;
    renderImportErrorBanner(refs, IMPORT_FAILED_PREFIX + reason, 'Check the browser console for details and try again.', retry);
    showToast(IMPORT_FAILED_PREFIX + reason, TOAST_ERROR);
    refs.lastImportFailed = true;
    focusAfter = 'banner';
  } finally {
    fileInput.value = '';
    fileInput.disabled = false;
    importBtn.disabled = false;
    importBtn.removeAttribute('aria-busy');
    hideImportSpinner(importBtn, originalLabel);
    hideImportProgress(refs);
    if (focusAfter === 'import') restoreFocusToImportButton(refs);
    else if (focusAfter === 'banner') focusErrorBanner(refs);
  }
}
