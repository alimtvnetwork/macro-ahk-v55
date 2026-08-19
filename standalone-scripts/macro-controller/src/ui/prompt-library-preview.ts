import { showToast } from '../toast';
import { parsePromptsText, previewPromptImport, type PromptImportPreview } from './prompt-io';
import { buildFriendlyImportError } from './prompt-import-error-message';
import {
  ModalRefs, PREVIEW_FAILED_PREFIX, TOAST_ERROR,
} from './prompt-library-types';
import { logLibraryImportFailure, extractImportErrorReason, renderImportErrorBanner } from './prompt-library-error';
import { PreviewTriggerType } from "../types/enums";
import { logError } from "../error-utils";

export function validateImportFile(file: File): { headline: string; hint: string } | null {
  const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

  if (!file || !(file instanceof File)) {
    return { headline: 'No file selected', hint: 'Please select a valid JSON file.' };
  }

  if (file.size === 0) {
    return { headline: 'File is empty', hint: 'Choose a non-empty prompt library JSON file.' };
  }

  if (file.size > IMPORT_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);

    return { headline: 'File is too large (' + mb + ' MB)', hint: 'Maximum allowed is 5 MB.' };
  }

  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  const extOk = name.endsWith('.json');
  const typeOk = type === '' || type === 'application/json' || type === 'text/json' || type.endsWith('+json');

  if (!extOk || !typeOk) {
    return { headline: 'Unsupported file type', hint: 'Choose a .json file.' };
  }

  return null;
}

function buildPreviewList(preview: PromptImportPreview, skipped: number): HTMLUListElement {
  const list = document.createElement('ul');
  list.style.cssText = 'list-style:disc;margin:0 0 8px 18px;padding:0;';
  const rows: [string, number][] = [
    ['New entries', preview.newEntries],
    ['Updated entries', preview.updatedEntries],
    ['Cache-only entries', preview.cacheOnlyEntries],
    ['Revisions', preview.revisions],
  ];
  for (const [label, n] of rows) {
    const li = document.createElement('li');
    li.textContent = label + ': ' + String(n);
    list.appendChild(li);
  }

  const warnRows: [number, string][] = [
    [preview.droppedByRole, 'Skipped by role filter: '],
    [preview.orphanRevisions, 'Orphan revisions (dropped): '],
    [skipped, 'Invalid entries skipped: '],
  ];
  for (const [count, label] of warnRows) {
    if (count <= 0) {
      continue;
    }

    const li = document.createElement('li');
    li.style.color = 'hsl(var(--destructive))';
    li.textContent = label + String(count);
    list.appendChild(li);
  }

  return list;
}

function buildPreviewButton(text: string, testid: string, css: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = text;
  btn.dataset.testid = testid;
  btn.style.cssText = css;
  btn.addEventListener('click', onClick);

  return btn;
}

function buildPreviewButtons(onConfirm: () => void, onCancel: () => void): HTMLDivElement {
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;';
  const confirmCss = 'background:hsl(var(--background));color:hsl(var(--foreground));border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;';
  const cancelCss = 'background:hsl(var(--muted));color:hsl(var(--foreground));border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;';
  btnRow.appendChild(buildPreviewButton('Confirm import', 'library-import-preview-confirm', confirmCss, onConfirm));
  btnRow.appendChild(buildPreviewButton('Cancel', 'library-import-preview-cancel', cancelCss, onCancel));

  return btnRow;
}

export function hidePreviewPanel(panel: HTMLDivElement): void {
  panel.hidden = true;
  panel.style.display = 'none';
  while (panel.firstChild) {
    panel.removeChild(panel.firstChild);
  }
}

export function renderPreviewPanel(
  refs: ModalRefs,
  panel: HTMLDivElement,
  preview: PromptImportPreview,
  file: File,
  skipped: number,
  onConfirm: () => void,
  onCancel: () => void,
): void {
  while (panel.firstChild) {
    panel.removeChild(panel.firstChild);
  }

  const heading = document.createElement('div');
  heading.style.cssText = 'font-weight:600;color:hsl(var(--foreground));margin-bottom:6px;';
  heading.textContent = 'Import preview: ' + file.name;
  panel.appendChild(heading);
  panel.appendChild(buildPreviewList(preview, skipped));
  panel.appendChild(buildPreviewButtons(onConfirm, onCancel));
  panel.hidden = false;
  panel.style.display = 'block';
  void refs;
}

function safeClearInput(input: HTMLInputElement): void {
  try {
    input.value = ''; 
  } catch (err) {
    logError('MacroController', 'Unknown error');
  }
}

async function doPreviewImport(
  refs: ModalRefs,
  file: File,
  previewFileInput: HTMLInputElement,
  importBtn: HTMLButtonElement,
  fileInput: HTMLInputElement,
  handleImportFile: (r: ModalRefs, f: File, fi: HTMLInputElement, ib: HTMLButtonElement, o: PreviewTriggerType) => Promise<void>,
  panel: HTMLDivElement
): Promise<void> {
  const text = await file.text();
  const parsed = parsePromptsText(text);

  if (parsed.errors.length > 0 && parsed.valid.length === 0) {
    const friendly = buildFriendlyImportError(parsed.errors, file.name);
    refs.status.textContent = 'Preview parse failed: ' + friendly.headline;
    renderImportErrorBanner(refs, friendly.headline, friendly.hint);
    showToast(PREVIEW_FAILED_PREFIX + friendly.headline, TOAST_ERROR);

    return;
  }

  const roleSel = refs.importRoleSelect?.value;
  const roleFilter = (roleSel === 'plan' || roleSel === 'next' || roleSel === 'generic') ? roleSel : undefined;
  const opts: Parameters<typeof previewPromptImport>[1] = {};

  if (roleFilter) {
    opts.roleFilter = roleFilter;
  }

  if (parsed.revisions && parsed.revisions.length > 0) {
    opts.revisions = parsed.revisions;
  }

  const preview = await previewPromptImport(parsed.valid, opts);
  renderPreviewPanel(refs, panel, preview, file, parsed.errors.length, () => {
    hidePreviewPanel(panel);
    safeClearInput(previewFileInput);
    void handleImportFile(refs, file, fileInput, importBtn, 'click');
  }, () => {
    hidePreviewPanel(panel);
    safeClearInput(previewFileInput);
    refs.status.textContent = 'Preview cancelled.';
  });
  refs.status.textContent = 'Preview ready for ' + file.name + '.';
}

export async function computeAndRenderPreview(
  refs: ModalRefs,
  file: File,
  previewFileInput: HTMLInputElement,
  importBtn: HTMLButtonElement,
  fileInput: HTMLInputElement,
  handleImportFile: (r: ModalRefs, f: File, fi: HTMLInputElement, ib: HTMLButtonElement, o: PreviewTriggerType) => Promise<void>,
): Promise<void> {
  const panel = refs.previewPanel;

  if (!panel) {
    return;
  }

  const invalid = validateImportFile(file);

  if (invalid) {
    refs.status.textContent = 'Preview rejected: ' + invalid.headline;
    renderImportErrorBanner(refs, invalid.headline, invalid.hint);
    showToast(PREVIEW_FAILED_PREFIX + invalid.headline, TOAST_ERROR);
    safeClearInput(previewFileInput);

    return;
  }

  refs.status.textContent = 'Previewing ' + file.name + ' ...';
  try {
    await doPreviewImport(refs, file, previewFileInput, importBtn, fileInput, handleImportFile, panel);
  } catch (err) {
    logError('MacroController', 'Unknown error');
    logLibraryImportFailure('preview', 'threw during read/parse for name=' + file.name, err);
    const reason = extractImportErrorReason(err);
    refs.status.textContent = PREVIEW_FAILED_PREFIX + reason;
    renderImportErrorBanner(refs, PREVIEW_FAILED_PREFIX + reason, 'Check the browser console for details and try again.');
    showToast(PREVIEW_FAILED_PREFIX + reason, TOAST_ERROR);
  }
}
