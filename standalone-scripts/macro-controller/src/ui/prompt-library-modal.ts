import { ModalRefs, MODAL_ID } from './prompt-library-types';
import { buildShell, buildControlsBar } from './prompt-library-shell';
import { buildImportProgressElement } from './prompt-library-progress';
import { wireImportExport, wirePreviewImport, wireDropZoneKeyboard } from './prompt-library-import-wiring';
import { renderAllRoles } from './prompt-library-list';
export { uniqueDupSlug } from './prompt-library-actions';
export { _resetLibraryImportFailureDedupeForTests } from './prompt-library-error';

function focusableNodesIn(root: HTMLElement): HTMLElement[] {
  const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const all = Array.from(root.querySelectorAll<HTMLElement>(sel));
  return all.filter((node) => !node.hasAttribute('disabled') && node.tabIndex !== -1);
}

function closeExisting(): void {
  const ex = document.getElementById(MODAL_ID);
  if (ex) ex.remove();
}

function handleModalKey(refs: ModalRefs, e: KeyboardEvent): void {
  const isMissingIsConnected = !refs.root.isConnected;
  if (isMissingIsConnected) {
    if (refs.keyHandler) document.removeEventListener('keydown', refs.keyHandler, true);
    return;
  }
  if (e.key === 'Escape') {
    if (refs.activeEditor) { e.preventDefault(); refs.activeEditor.cancel(); return; }
    e.preventDefault();
    closeExisting();
    return;
  }
  const saveCombo = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S');
  if (saveCombo && refs.activeEditor) {
    e.preventDefault();
    refs.activeEditor.save();
    return;
  }
  if (e.key === 'Tab') applyTabTrap(refs.root, e);
}

function applyTabTrap(root: HTMLElement, e: KeyboardEvent): void {
  const nodes = focusableNodesIn(root);
  if (nodes.length === 0) return;
  const first = nodes[0]!;
  const last = nodes[nodes.length - 1]!;
  const active = document.activeElement as HTMLElement | null;
  const insideModal = active !== null && root.contains(active);
  const isMissingInsideModal = !insideModal;
  if (isMissingInsideModal) { e.preventDefault(); first.focus(); return; }
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); return; }
  if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

export async function openPromptLibraryModal(): Promise<void> {
  closeExisting();
  const shell = buildShell();
  shell.root.id = MODAL_ID;

  const refs: ModalRefs = {
    root: shell.root,
    body: shell.body,
    status: shell.status,
    errorBanner: shell.errorBanner,
    fileInfo: shell.fileInfo,
    view: { filterRole: 'all', sortMode: 'default-first', expandedIds: new Set() },
    activeEditor: null,
    includeRevisionsCb: shell.includeRevisionsCb,
    importRoleSelect: shell.importRoleSelect,
    previewPanel: shell.previewPanel,
    previewFileInput: shell.previewFileInput,
    partialErrorsPanel: shell.partialErrorsPanel,
  };

  const progressEl = buildImportProgressElement();
  refs.importProgress = progressEl;
  shell.body.parentElement?.insertBefore(progressEl.wrap, shell.body);

  const controls = buildControlsBar(refs);
  shell.body.parentElement?.insertBefore(controls, shell.body);

  wireImportExport(refs, shell.exportBtn, shell.importBtn, shell.fileInput, renderAllRoles);
  wirePreviewImport(refs, shell.previewBtn, shell.previewFileInput, shell.importBtn, shell.fileInput, renderAllRoles);
  wireDropZoneKeyboard(shell.dropZone, shell.importBtn, shell.fileInput);

  refs.keyHandler = (e: KeyboardEvent) => handleModalKey(refs, e);
  document.addEventListener('keydown', refs.keyHandler, true);

  refs.pagehideHandler = () => closeExisting();
  window.addEventListener('pagehide', refs.pagehideHandler, { once: true });

  document.body.appendChild(shell.root);

  // Click on scrim (not panel) closes.
  shell.root.addEventListener('click', (e) => { if (e.target === shell.root) closeExisting(); });

  const closeBtn = shell.root.querySelector<HTMLButtonElement>('button[data-testid="library-close"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeExisting);
    closeBtn.focus();
  }

  await renderAllRoles(refs);
}
