const ERROR_CONTEXT_AUTOCATCH = "AutoCatch", ERROR_MSG_UNHANDLED = "Unhandled exception";
import { logError } from '../error-utils';
import {
  ModalRefs,
  LOG_SCOPE,
  ATTR_ARIA_LABEL,
  CSS_BORDER_RADIUS_6,
  CSS_CURSOR_POINTER,
} from './prompt-library-types';

interface ImportDedupeEntry { lastAt: number; suppressed: number; }
const _libraryImportFailureDedupe = new Map<string, ImportDedupeEntry>();

export function _resetLibraryImportFailureDedupeForTests(): void {
  _libraryImportFailureDedupe.clear();
}

export function logLibraryImportFailure(key: string, detail: string, cause?: unknown): void {
  const now = Date.now();
  const prev = _libraryImportFailureDedupe.get(key);
  if (prev && (now - prev.lastAt) < 60000) {
    prev.suppressed += 1;
    prev.lastAt = now;

    return;
  }

  const suffix = prev && prev.suppressed > 0
    ? ' [dedup: ' + String(prev.suppressed) + ' identical entr' + (prev.suppressed === 1 ? 'y' : 'ies') + ' suppressed in prior 60s window]'
    : '';
  if (cause === undefined) {
    logError(LOG_SCOPE, 'handleImportFile[' + key + ']: ' + detail + suffix);
  } else {
    logError(LOG_SCOPE, 'handleImportFile[' + key + ']: ' + detail + suffix, cause);
  }

  _libraryImportFailureDedupe.set(key, { lastAt: now, suppressed: 0 });
}

export function extractImportErrorReason(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message.split('\n')[0]!.slice(0, 240);
  }

  if (typeof err === 'string' && err.length > 0) {
    return err.split('\n')[0]!.slice(0, 240);
  }

  return 'Unknown error';
}

function btnCss(bg: string, fg: string): string {
  return [
    'background:' + bg, 'color:' + fg,
    'border:1px solid #3a465c', CSS_BORDER_RADIUS_6,
    'padding:4px 10px', 'font-size:11px', CSS_CURSOR_POINTER,
    'margin-left:6px',
  ].join(';');
}

export function renderImportErrorBanner(
  refs: ModalRefs,
  headline: string,
  hint: string,
  onRetry?: () => void,
): void {
  refs.errorBanner.textContent = '';
  refs.errorBanner.hidden = false;
  refs.errorBanner.style.display = 'block';
  const h = document.createElement('div');
  h.dataset.testid = 'library-import-error-headline';
  h.style.cssText = 'font-weight:600;margin-bottom:4px;';
  h.textContent = headline;
  const p = document.createElement('div');
  p.dataset.testid = 'library-import-error-hint';
  p.style.cssText = 'opacity:0.85;';
  p.textContent = hint;
  refs.errorBanner.appendChild(h);
  refs.errorBanner.appendChild(p);
  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.textContent = 'Retry import';
    retryBtn.dataset.testid = 'library-import-retry';
    retryBtn.setAttribute(ATTR_ARIA_LABEL, 'Retry import with the same file');
    retryBtn.style.cssText = btnCss('#6b2c34', '#ffd7dc') + ';margin-top:8px;';
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRetry();
    });
    refs.errorBanner.appendChild(retryBtn);
  }
}

export function clearImportErrorBanner(refs: ModalRefs): void {
  refs.errorBanner.textContent = '';
  refs.errorBanner.hidden = true;
  refs.errorBanner.style.display = 'none';
}

export function focusErrorBanner(refs: ModalRefs): void {
  if (!refs.root.isConnected) {
    return;
  }

  const banner = refs.errorBanner;
  if (!banner || banner.hidden) {
    return;
  }

  try {
    banner.focus(); 
  } catch (err) {
    logError('MacroController', 'Unknown error');
  }
}
