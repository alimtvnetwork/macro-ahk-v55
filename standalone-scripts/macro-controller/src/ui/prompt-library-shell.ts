import { ModalRefs, ROLE_FILTERS, SORT_MODES, SortMode, CSS_CURSOR_POINTER, CSS_BORDER_RADIUS_6, CSS_PADDING_10_12, CSS_FONT_SIZE_12, CSS_BG_MUTED_1, CSS_BORDER_DEFAULT, CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10 } from './prompt-library-types';
import { renderAllRoles } from './prompt-library-list';

export function chipCss(isActive: boolean): string {
  const bg = isActive ? '#3a2f6b' : '#243050';
  const fg = isActive ? '#ffe08a' : '#e6edf7';

  return [
    'background:' + bg, 'color:' + fg,
    'border:1px solid #3a465c', 'border-radius:999px',
    'padding:2px 8px', 'font-size:10px', CSS_CURSOR_POINTER,
  ].join(';');
}

export function buildFilterChips(refs: ModalRefs): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:4px;align-items:center;';
  const label = document.createElement('span');
  label.textContent = 'Role:';
  label.style.cssText = 'font-size:10px;color:#7a8699;margin-right:2px;';
  wrap.appendChild(label);
  for (const role of ROLE_FILTERS) {
    const chip = document.createElement('button');
    chip.textContent = role;
    chip.dataset.role = role;
    chip.style.cssText = chipCss(refs.view.filterRole === role);
    chip.addEventListener('click', () => {
      refs.view.filterRole = role;
      for (const other of Array.from(wrap.querySelectorAll<HTMLButtonElement>('button[data-role]'))) {
        other.style.cssText = chipCss(other.dataset.role === role);
      }
      void renderAllRoles(refs);
    });
    wrap.appendChild(chip);
  }

  return wrap;
}

export function buildSortSelect(refs: ModalRefs): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:4px;align-items:center;margin-left:8px;';
  const label = document.createElement('span');
  label.textContent = 'Sort:';
  label.style.cssText = 'font-size:10px;color:#7a8699;';
  const select = document.createElement('select');
  select.dataset.testid = 'library-sort';
  select.style.cssText = 'background:#0f1522;color:#e6edf7;border:1px solid #2b3648;border-radius:4px;font-size:11px;padding:2px 4px;';
  for (const mode of SORT_MODES) {
    const opt = document.createElement('option');
    opt.value = mode;
    opt.textContent = mode;
    select.appendChild(opt);
  }
  select.value = refs.view.sortMode;
  select.addEventListener('change', () => {
    refs.view.sortMode = select.value as SortMode;
    void renderAllRoles(refs);
  });
  wrap.appendChild(label);
  wrap.appendChild(select);

  return wrap;
}

export function buildControlsBar(refs: ModalRefs): HTMLElement {
  const bar = document.createElement('div');
  bar.dataset.testid = 'library-controls';
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px;padding:6px 8px;background:#0f1522;border:1px solid #2b3648;border-radius:6px;';
  bar.appendChild(buildFilterChips(refs));
  bar.appendChild(buildSortSelect(refs));

  return bar;
}

export interface ShellEls {
  root: HTMLDivElement;
  body: HTMLDivElement;
  status: HTMLDivElement;
  errorBanner: HTMLDivElement;
  importBtn: HTMLButtonElement;
  exportBtn: HTMLButtonElement;
  fileInput: HTMLInputElement;
  fileInfo: HTMLDivElement;
  previewBtn: HTMLButtonElement;
  previewFileInput: HTMLInputElement;
  previewPanel: HTMLDivElement;
  includeRevisionsCb: HTMLInputElement;
  importRoleSelect: HTMLSelectElement;
  partialErrorsPanel: HTMLDivElement;
  dropZone: HTMLDivElement;
}

function buildHeaderPreviewGroup() {
  const previewGroup = document.createElement('div');
  previewGroup.style.cssText = 'display:flex;align-items:center;border-right:1px solid #2b3648;padding-right:12px;';
  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.textContent = 'Preview Import';
  previewBtn.dataset.testid = 'library-import-preview';
  previewBtn.style.cssText = 'background:#1a2333;color:#c9d3e6;border:1px solid #2b3648;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;';
  const previewFileInput = document.createElement('input');
  previewFileInput.type = 'file';
  previewFileInput.dataset.testid = 'library-import-preview-file';
  previewFileInput.accept = '.json,application/json';
  previewFileInput.hidden = true;
  previewGroup.appendChild(previewBtn);
  previewGroup.appendChild(previewFileInput);

  return { previewGroup, previewBtn, previewFileInput };
}

function buildHeaderImportGroup() {
  const importGroup = document.createElement('div');
  importGroup.style.cssText = 'display:flex;align-items:center;gap:6px;';
  const importRoleSelect = document.createElement('select');
  importRoleSelect.title = 'Filter imported prompts by role. "All roles" imports exactly as exported.';
  importRoleSelect.dataset.testid = 'library-import-role-filter';
  importRoleSelect.style.cssText = 'background:#0f1522;color:#c9d3e6;border:1px solid #2b3648;border-radius:4px;font-size:11px;padding:2px 4px;';
  for (const r of ['All roles', 'plan', 'next', 'generic']) {
    const o = document.createElement('option');
    o.value = r === 'All roles' ? 'all' : r;
    o.textContent = r;
    importRoleSelect.appendChild(o);
  }
  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.textContent = 'Import';
  importBtn.dataset.testid = 'library-import';
  importBtn.style.cssText = 'background:#243050;color:#e6edf7;border:1px solid #3a465c;border-radius:6px;padding:4px 12px;font-size:11.5px;cursor:pointer;';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.dataset.testid = 'library-import-file';
  fileInput.accept = '.json,application/json';
  fileInput.hidden = true;
  importGroup.appendChild(importRoleSelect);
  importGroup.appendChild(importBtn);
  importGroup.appendChild(fileInput);

  return { importGroup, importRoleSelect, importBtn, fileInput };
}

function buildHeaderExportGroup() {
  const exportGroup = document.createElement('div');
  exportGroup.style.cssText = 'display:flex;align-items:center;gap:6px;';
  const includeRevisionsLabel = document.createElement('label');
  includeRevisionsLabel.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;color:#9aa7bd;cursor:pointer;margin-right:2px;';
  const includeRevisionsCb = document.createElement('input');
  includeRevisionsCb.type = 'checkbox';
  includeRevisionsCb.checked = false;
  includeRevisionsCb.dataset.testid = 'library-export-include-revisions';
  includeRevisionsLabel.appendChild(includeRevisionsCb);
  includeRevisionsLabel.appendChild(document.createTextNode('Hist'));
  includeRevisionsLabel.title = 'Include full revision history in the export file';
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.textContent = 'Export JSON';
  exportBtn.dataset.testid = 'library-export';
  exportBtn.style.cssText = 'background:#243050;color:#e6edf7;border:1px solid #3a465c;border-radius:6px;padding:4px 12px;font-size:11.5px;cursor:pointer;';
  exportGroup.appendChild(includeRevisionsLabel);
  exportGroup.appendChild(exportBtn);

  return { exportGroup, includeRevisionsCb, exportBtn };
}

function buildHeaderMiscButtons() {
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'x';
  closeBtn.dataset.testid = 'library-close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.style.cssText = 'background:transparent;border:none;color:#9aa7bd;font-size:24px;cursor:pointer;padding:0 4px;margin-left:8px;line-height:1;';

  const sampleBtn = document.createElement('button');
  sampleBtn.type = 'button';
  sampleBtn.textContent = '📄 Sample JSON';
  sampleBtn.dataset.testid = 'library-sample-json';
  sampleBtn.title = 'Download a reference prompts-sample.json you can edit and re-import';
  sampleBtn.style.cssText = 'background:#243050;color:#e6edf7;border:1px solid #3a465c;border-radius:6px;padding:4px 12px;font-size:11.5px;cursor:pointer;';
  sampleBtn.addEventListener('click', () => {
      void import('./prompt-sample-json').then((m) => m.downloadSamplePromptsJson());
  });

  return { closeBtn, sampleBtn };
}

function buildDropZone(importBtn: HTMLButtonElement, fileInput: HTMLInputElement) {
  const dropZone = document.createElement('div');
  dropZone.dataset.testid = 'library-drop-zone';
  dropZone.setAttribute('role', 'button');
  dropZone.setAttribute('tabindex', '0');
  dropZone.setAttribute('aria-label', 'Import prompts: drop a JSON file here, or press Enter to choose a file');
  dropZone.style.cssText = [
      CSS_MARGIN_BOTTOM_10, CSS_PADDING_10_12,
      'border:1px dashed #3a4863', CSS_BORDER_RADIUS_6,
      CSS_BG_MUTED_1, 'color:#9aa7bd',
      CSS_FONT_SIZE_12, 'text-align:center', CSS_CURSOR_POINTER,
      'outline:2px solid transparent', 'outline-offset:2px',
      'transition:outline-color 120ms ease, box-shadow 120ms ease',
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:8px',
  ].join(';');
  const dropZoneText = document.createElement('span');
  dropZoneText.textContent = 'Drop a JSON file here, or press Enter to choose a file';
  dropZone.appendChild(dropZoneText);
  const chooseFileBtn = document.createElement('button');
  chooseFileBtn.type = 'button';
  chooseFileBtn.textContent = 'Choose file';
  chooseFileBtn.dataset.testid = 'library-choose-file';
  chooseFileBtn.setAttribute('aria-label', 'Choose a JSON file to import');
  chooseFileBtn.style.cssText = 'background:#243050;color:#e6edf7;border:1px solid #3a465c;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;margin-left:6px;';
  chooseFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (importBtn.disabled) return;
      fileInput.click();
  });
  chooseFileBtn.addEventListener('keydown', (e) => { e.stopPropagation(); });
  dropZone.appendChild(chooseFileBtn);
  const applyFocusRing = (): void => {
      dropZone.style.outlineColor = '#7cc4ff';
      dropZone.style.boxShadow = '0 0 0 4px rgba(124, 196, 255, 0.25)';
      dropZone.style.borderColor = '#7cc4ff';
  };
  const clearFocusRing = (): void => {
      dropZone.style.outlineColor = 'transparent';
      dropZone.style.boxShadow = 'none';
      dropZone.style.borderColor = '#3a4863';
  };
  dropZone.addEventListener('focus', applyFocusRing);
  dropZone.addEventListener('blur', clearFocusRing);

  return dropZone;
}

function _buildStatusPanels() {
  const errorBanner = document.createElement('div');
  errorBanner.dataset.testid = 'library-import-error';
  errorBanner.tabIndex = -1;
  errorBanner.setAttribute('role', 'alert');
  errorBanner.setAttribute('aria-live', 'assertive');
  errorBanner.setAttribute('aria-atomic', 'true');
  errorBanner.hidden = true;
  errorBanner.style.cssText = [CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, CSS_PADDING_10_12, 'background:#3a2530', 'border:1px solid #6b2b3a', CSS_BORDER_RADIUS_6, CSS_FONT_SIZE_12, 'color:#f2c9c9', 'outline:none'].join(';');

  const fileInfo = document.createElement('div');
  fileInfo.dataset.testid = 'library-file-info';
  fileInfo.hidden = true;
  fileInfo.setAttribute('aria-live', 'polite');
  fileInfo.style.cssText = [CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, CSS_PADDING_10_12, CSS_BG_MUTED_1, CSS_BORDER_DEFAULT, CSS_BORDER_RADIUS_6, CSS_FONT_SIZE_12, 'color:#a3b4cc', 'font-family:ui-monospace,monospace'].join(';');

  const previewPanel = document.createElement('div');
  previewPanel.dataset.testid = 'library-import-preview-panel';
  previewPanel.hidden = true;
  previewPanel.style.cssText = [CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, CSS_PADDING_10_12, 'background:#1c2336', CSS_BORDER_DEFAULT, CSS_BORDER_RADIUS_6, CSS_FONT_SIZE_12, 'color:#d1dbe8'].join(';');

  const partialErrorsPanel = document.createElement('div');
  partialErrorsPanel.dataset.testid = 'library-import-partial-errors';
  partialErrorsPanel.hidden = true;
  partialErrorsPanel.style.cssText = [CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, CSS_PADDING_10_12, 'background:#2d1b22', 'border:1px solid #5a2431', CSS_BORDER_RADIUS_6, CSS_FONT_SIZE_12, 'color:#e8b5b5'].join(';');

  return { errorBanner, fileInfo, previewPanel, partialErrorsPanel };
}

function _buildActionWrap() {
  const actionWrap = document.createElement('div');
  actionWrap.style.cssText = 'display:flex;align-items:center;gap:12px;';

  const { previewGroup, previewBtn, previewFileInput } = buildHeaderPreviewGroup();
  const { importGroup, importRoleSelect, importBtn, fileInput } = buildHeaderImportGroup();
  const { exportGroup, includeRevisionsCb, exportBtn } = buildHeaderExportGroup();
  const { closeBtn, sampleBtn } = buildHeaderMiscButtons();

  actionWrap.appendChild(previewGroup);
  actionWrap.appendChild(importGroup);
  actionWrap.appendChild(exportGroup);
  actionWrap.appendChild(sampleBtn);
  actionWrap.appendChild(closeBtn);
  actionWrap.appendChild(previewFileInput);
  actionWrap.appendChild(fileInput);

  return {
    actionWrap,
    refs: { previewBtn, previewFileInput, importRoleSelect, importBtn, fileInput, includeRevisionsCb, exportBtn, closeBtn, sampleBtn }
  };
}

function _buildHeader(actionWrap: HTMLElement): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';
  const title = document.createElement('div');
  title.textContent = '≡ƒùé Prompt Library';
  title.style.cssText = 'font-size:15px;font-weight:600;color:#c9b7ff;';
  header.appendChild(title);
  header.appendChild(actionWrap);

  return header;
}

export function buildShell(): ShellEls {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483000',
    'background:rgba(0,0,0,0.55)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font-family:system-ui,-apple-system,sans-serif',
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'width:min(720px,92vw)', 'max-height:85vh', 'overflow:auto',
    'background:#121826', 'color:#e6edf7',
    CSS_BORDER_DEFAULT, 'border-radius:10px',
    'box-shadow:0 20px 60px rgba(0,0,0,0.6)',
    'padding:16px 18px',
  ].join(';');

  const { actionWrap, refs } = _buildActionWrap();
  const { previewBtn, previewFileInput, importRoleSelect, importBtn, fileInput, includeRevisionsCb, exportBtn, closeBtn, sampleBtn } = refs;

  const header = _buildHeader(actionWrap);
  const scrollWrap = document.createElement('div');
  scrollWrap.style.cssText = 'flex:1;overflow-y:auto;padding:16px 20px;';
  const { errorBanner, fileInfo, previewPanel, partialErrorsPanel } = _buildStatusPanels();

  const dropZone = buildDropZone(importBtn, fileInput);

  const body = document.createElement('div');
  body.dataset.testid = 'library-body';
  scrollWrap.appendChild(errorBanner);
  scrollWrap.appendChild(fileInfo);
  scrollWrap.appendChild(previewPanel);
  scrollWrap.appendChild(partialErrorsPanel);
  scrollWrap.appendChild(body);

  const footer = document.createElement('div');
  footer.style.cssText = 'padding:10px 20px;border-top:1px solid #1c2536;background:#0f1522;flex-shrink:0;';
  const status = document.createElement('div');
  status.dataset.testid = 'library-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  status.style.cssText = 'font-size:11px;color:#7a8699;text-align:right;flex:1;';
  footer.appendChild(status);

  panel.appendChild(header);
  panel.appendChild(status);
  panel.appendChild(errorBanner);
  panel.appendChild(fileInfo);
  panel.appendChild(previewPanel);
  panel.appendChild(partialErrorsPanel);
  panel.appendChild(dropZone);
  panel.appendChild(body);
  root.appendChild(panel);

  return {
    root, body, status, errorBanner, importBtn, exportBtn, fileInput,
    fileInfo, previewBtn, previewFileInput, previewPanel,
    includeRevisionsCb, importRoleSelect, partialErrorsPanel, dropZone
  };
}
