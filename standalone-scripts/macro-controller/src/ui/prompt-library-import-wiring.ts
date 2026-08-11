import { ModalRefs } from './prompt-library-types';
import { handleExport, handleImportFile } from './prompt-library-import-pipeline';
import { computeAndRenderPreview } from './prompt-library-preview';

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  if (bytes < 1024) {
    return bytes + ' B';
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return kb.toFixed(1) + ' KB';
  }

  return (kb / 1024).toFixed(1) + ' MB';
}

export function renderSelectedFileInfo(refs: ModalRefs, file: File): void {
  refs.fileInfo.textContent = 'Selected file: ' + file.name + ' (' + formatFileSize(file.size) + ')';
  refs.fileInfo.hidden = false;
  refs.fileInfo.style.display = 'block';
}

export function wireImportDropZone(
  refs: ModalRefs,
  importBtn: HTMLButtonElement,
  fileInput: HTMLInputElement,
  renderAllRoles: (r: ModalRefs) => Promise<void>,
): void {
  const onDragOver = (e: DragEvent): void => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = importBtn.disabled ? 'none' : 'copy';
    }
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    if (importBtn.disabled) {
      return;
    }

    const file = e.dataTransfer?.files && e.dataTransfer.files[0];
    if (!file) {
      return;
    }

    renderSelectedFileInfo(refs, file);
    void handleImportFile(refs, file, fileInput, importBtn, renderAllRoles, 'drop');
  };

  refs.root.addEventListener('dragover', onDragOver);
  refs.root.addEventListener('drop', onDrop);
}

export function wireDropZoneKeyboard(
  dropZone: HTMLDivElement,
  importBtn: HTMLButtonElement,
  fileInput: HTMLInputElement,
): void {
  const activate = (): void => {
    if (importBtn.disabled) {
      return;
    }

    fileInput.click();
  };

  dropZone.addEventListener('click', activate);
  dropZone.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') {
      return;
    }

    e.preventDefault();
    activate();
  });
}

export function wireImportExport(
  refs: ModalRefs,
  exportBtn: HTMLButtonElement,
  importBtn: HTMLButtonElement,
  fileInput: HTMLInputElement,
  renderAllRoles: (r: ModalRefs) => Promise<void>,
): void {
  exportBtn.addEventListener('click', () => {
    void handleExport(refs); 
  });
  importBtn.addEventListener('click', () => {
    if (importBtn.disabled) {
      return;
    }

    fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      return;
    }

    renderSelectedFileInfo(refs, file);
    void handleImportFile(refs, file, fileInput, importBtn, renderAllRoles, 'click');
  });
  wireImportDropZone(refs, importBtn, fileInput, renderAllRoles);
}

export function wirePreviewImport(
  refs: ModalRefs,
  previewBtn: HTMLButtonElement,
  previewFileInput: HTMLInputElement,
  importBtn: HTMLButtonElement,
  fileInput: HTMLInputElement,
  renderAllRoles: (r: ModalRefs) => Promise<void>,
): void {
  previewBtn.addEventListener('click', () => {
    if (importBtn.disabled) {
      return;
    }

    previewFileInput.click();
  });
  previewFileInput.addEventListener('change', () => {
    const file = previewFileInput.files && previewFileInput.files[0];
    if (!file) {
      return;
    }

    renderSelectedFileInfo(refs, file);
    void computeAndRenderPreview(refs, file, previewFileInput, importBtn, fileInput, (r, f, fi, ib, o) => handleImportFile(r, f, fi, ib, renderAllRoles, o));
  });
}
