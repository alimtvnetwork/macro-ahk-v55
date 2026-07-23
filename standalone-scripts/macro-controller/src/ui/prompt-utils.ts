 
import { toErrorMessage, logError } from '../error-utils';
/**
 * MacroLoop Controller — Prompt Utility Functions
 * Step 03d: Extracted from createUI() closure
 *
 * Pure/near-pure functions for prompt loading, parsing, pasting.
 */

import { log, logSub } from '../logger';
import type { PromptEntry, PromptsCfg } from '../types';
import { DomId } from '../types';
import { showToast } from '../toast';
import { captureChatSubmit } from '../capture/chat-submit-capture';
import type { ChatSubmitSource } from '../db/project-chat-submit-db';
import { TOAST_MAX_STACK } from '../constants';
import { getProjectKvStore } from '../project-kv-store';
import { extractProjectIdFromUrl } from '../workspace-detection';
import { saveCommunication } from '../db/macro-db';





async function capturePasteSubmit(text: string, source: ChatSubmitSource): Promise<void> {
  try { await captureChatSubmit({ source, text }); }
  catch (e) { logError('capturePasteSubmit', 'chat-submit capture threw', e); }
}


// ── Prompt entry normalization ──
// eslint-disable-next-line sonarjs/cognitive-complexity -- field-by-field validation with optional property copying
export function normalizePromptEntries(entries: Partial<PromptEntry & { order?: number }>[]): PromptEntry[] {
  if (!Array.isArray(entries)) return [];
  const out: PromptEntry[] = [];
  let droppedCount = 0;
  for (const p of entries) {
    const raw = p || {};
    const name = typeof raw.name === 'string' ? raw.name : '';
    const text = typeof raw.text === 'string' ? raw.text : '';

    if (name && text) {
      // Dynamic expansion: emit one flat entry per replaceValue.
      if (raw.isDynamic && raw.replaceKey && Array.isArray(raw.replaceValues) && raw.replaceValues.length > 0) {
        for (const v of raw.replaceValues) {
          out.push(buildExpandedEntry(raw, name, text, String(v)));
        }
        continue;
      }

      const entry: PromptEntry = { name, text };
      if (raw.id) { entry.id = raw.id; }
      if (raw.slug) { entry.slug = raw.slug; }
      if (raw.category) { entry.category = raw.category; }
      if (raw.isFavorite) { entry.isFavorite = true; }
      if (raw.isDefault !== undefined) { entry.isDefault = raw.isDefault; }
      if (Array.isArray(raw.tags)) { entry.tags = raw.tags; }
      else { entry.tags = autoTagPrompt(name, text); }

      out.push(entry);
    } else {
      droppedCount++;
      console.warn('[normalizePromptEntries] ⚠️ Dropped entry — name="' + (name || '(empty)') + '", text.length=' + text.length + ', id=' + (raw.id || '—') + ', slug=' + (raw.slug || '—') + '. Reason: ' + (!name ? 'missing name' : 'missing text'));
    }
  }
  if (droppedCount > 0) {
    console.warn('[normalizePromptEntries] ⚠️ Dropped ' + droppedCount + '/' + entries.length + ' entries due to missing name or text');
  }
  return out;
}

/** Replace every `${key}` occurrence in a string. */
function substituteKey(s: string, key: string, value: string): string {
  return s.split('${' + key + '}').join(value);
}

/** Build one expanded PromptEntry for a dynamic prompt + a single replaceValue. */
function buildExpandedEntry(
  raw: Partial<PromptEntry>,
  name: string,
  text: string,
  value: string,
): PromptEntry {
  const key = raw.replaceKey as string;
  const expandedName = substituteKey(name, key, value);
  const expandedText = substituteKey(text, key, value);
  const slugBase = raw.slugTemplate || raw.slug || expandedName.toLowerCase().replace(/\s+/g, '-');
  const expandedSlug = substituteKey(slugBase, key, value);
  const entry: PromptEntry = { name: expandedName, text: expandedText, slug: expandedSlug };
  if (raw.id) { entry.id = substituteKey(String(raw.id), key, value) + '-' + value; }
  if (raw.category) { entry.category = raw.category; }
  if (raw.isFavorite) { entry.isFavorite = true; }
  if (raw.isDefault !== undefined) { entry.isDefault = raw.isDefault; }
  // Bridge fields per spec/30-next-button-reference/01-spec.md §1: let future
  // chip-row UI collapse expanded variants back into their parent group.
  entry.parentTitle = name;
  if (raw.slug) { entry.parentSlug = raw.slug; }
  entry.variantValue = value;
  entry.tags = Array.isArray(raw.tags) ? raw.tags : autoTagPrompt(expandedName, expandedText);
  return entry;
}

/** Auto-tag a prompt based on its name and content. */
function autoTagPrompt(name: string, text: string): string[] {
  const tags: string[] = [];
  const content = (name + ' ' + text).toLowerCase();
  
  if (content.includes('ui') || content.includes('style') || content.includes('css')) tags.push('ui');
  if (content.includes('fix') || content.includes('bug') || content.includes('issue')) tags.push('fix');
  if (content.includes('test') || content.includes('spec') || content.includes('vitest')) tags.push('testing');
  if (content.includes('backend') || content.includes('api') || content.includes('sql')) tags.push('backend');
  if (content.includes('refactor') || content.includes('clean')) tags.push('refactor');
  
  return tags;
}

/** Normalize excessive blank lines: collapse 3+ consecutive newlines to 2 (one blank line).
 *  Also normalizes \r\n to \n and collapses lines containing only whitespace. */
export function normalizeNewlines(text: string): string {
  return text
    .replace(/\r\n/g, '\n')                    // Normalize Windows line endings
    .replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n')     // Collapse blank-ish lines (whitespace-only between newlines)
    .replace(/\n{3,}/g, '\n\n')                  // Collapse 3+ consecutive newlines to 2
    .trim();
}

// ── JSON parse with truncation recovery ──
export function parseWithRecovery(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (e) {
    logError('parseWithRecovery', 'JSON parse failed, attempting recovery', e);
    const trimmed = String(content || '').trim();
    const lastBrace = trimmed.lastIndexOf('}');
    if (lastBrace > 0) {
      let repaired = trimmed.substring(0, lastBrace + 1);
      if (trimmed.charAt(0) === '[') {
        repaired += ']';
      }
      try {
        return JSON.parse(repaired);
      } catch (_repairErr) { logSub('JSON repair also failed: ' + (_repairErr instanceof Error ? _repairErr.message : String(_repairErr)), 1); }
    }
    throw e;
  }
}

// ── Toast notification system (solid dark minimal, left accent bar, stacking max 3) ──



function _getOrCreateToastContainer(): HTMLElement {
  let container = document.getElementById(DomId.ToastStack);
  if (!container) {
    container = document.createElement('div');
    container.id = DomId.ToastStack;
    container.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'display:flex;flex-direction:column-reverse;gap:6px;z-index:1000000;pointer-events:none;';
    document.body.appendChild(container);
  }
  return container;
}

export function showPasteToast(message: string, isError: boolean): void {
  const container = _getOrCreateToastContainer();

  // Enforce max stack — remove oldest if at limit
  while (container.children.length >= TOAST_MAX_STACK) {
    const oldest = container.lastElementChild;
    if (oldest) oldest.remove();
  }

  const isMultiline = message.indexOf('\n') !== -1;
  const toast = document.createElement('div');
  toast.style.cssText = 'display:flex;align-items:stretch;border-radius:6px;overflow:hidden;' +
    'background:#1a1a2e;border:1px solid rgba(255,255,255,0.06);' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.4);' +
    'font-family:system-ui,-apple-system,sans-serif;pointer-events:auto;' +
    'transform:translateY(8px);opacity:0;transition:all .25s ease-out;' +
    (isMultiline ? 'max-width:520px;' : 'max-width:380px;');

  // Left accent bar
  const accent = document.createElement('div');
  accent.style.cssText = 'width:3px;flex-shrink:0;' +
    (isError ? 'background:#ef4444;' : 'background:#22c55e;');
  toast.appendChild(accent);

  // Content area
  const content = document.createElement('div');
  content.style.cssText = 'padding:8px 14px;font-size:12px;line-height:1.4;color:#e2e8f0;' +
    'display:flex;' + (isMultiline ? 'align-items:flex-start;' : 'align-items:center;') + 'gap:6px;';

  // Icon
  const icon = document.createElement('span');
  icon.style.cssText = 'font-size:13px;flex-shrink:0;' + (isMultiline ? 'margin-top:1px;' : '');
  icon.textContent = isError ? '✕' : '✓';
  content.appendChild(icon);

  // Text — `white-space:pre-line` preserves `\n` so save-time error toasts
  // can render structured rows (rule / button / detail / fix).
  const text = document.createElement('span');
  text.textContent = message;
  text.style.cssText = 'flex:1;white-space:pre-line;';
  content.appendChild(text);

  toast.appendChild(content);
  container.insertBefore(toast, container.firstChild);

  // Animate in
  requestAnimationFrame(function() {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Auto-dismiss — give multi-line error toasts extra reading time.
  const duration = isError ? (isMultiline ? 8000 : 4500) : 2800;
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(function() { toast.remove(); }, 250);
  }, duration);
}

/**
 * Undo toast for destructive prompt saves (chip edit / restore-from-history /
 * reset-to-default). Renders inside the same `#DomId.ToastStack` container as
 * `showPasteToast` so stacking + z-index behaviour is identical. Fires
 * `onUndo` at most once, either from the button click or an explicit dismiss.
 * Auto-dismisses after `timeoutMs` (default 8s) — long enough for a human to
 * react but short enough to not clutter the strip.
 *
 * Contract:
 *   - Never throws. onUndo errors are logged via logError and surfaced as an
 *     error toast; the toast itself is always removed.
 *   - "Undo" click is idempotent: pressing it a second time is a no-op.
 */
function _buildUndoToastShell(): { toast: HTMLDivElement; content: HTMLDivElement; body: HTMLDivElement } {
  const toast = document.createElement('div');
  toast.dataset.testid = 'undo-toast';
  toast.style.cssText = 'display:flex;align-items:stretch;border-radius:6px;overflow:hidden;' +
    'background:#1a1a2e;border:1px solid rgba(255,255,255,0.06);' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.4);' +
    'font-family:system-ui,-apple-system,sans-serif;pointer-events:auto;' +
    'transform:translateY(8px);opacity:0;transition:all .25s ease-out;max-width:420px;' +
    'position:relative;';

  const accent = document.createElement('div');
  accent.style.cssText = 'width:3px;flex-shrink:0;background:#22c55e;';
  toast.appendChild(accent);

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;flex:1;min-width:0;';

  const content = document.createElement('div');
  content.style.cssText = 'padding:8px 10px 8px 14px;font-size:12px;line-height:1.4;color:#e2e8f0;' +
    'display:flex;align-items:center;gap:10px;flex:1;';

  const icon = document.createElement('span');
  icon.style.cssText = 'font-size:13px;flex-shrink:0;';
  icon.textContent = '✓';
  content.appendChild(icon);
  body.appendChild(content);
  toast.appendChild(body);
  return { toast, content, body };
}

function _buildIdChip(restoredId: number | string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.dataset.testid = 'undo-toast-restored-id';
  chip.textContent = '#' + String(restoredId);
  chip.title = 'Restored row id';
  chip.style.cssText = 'flex-shrink:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;' +
    'font-size:10px;padding:2px 6px;border-radius:3px;background:rgba(196,181,253,0.12);' +
    'color:#c4b5fd;border:1px solid rgba(196,181,253,0.25);';
  return chip;
}

function _buildCountdown(durationMs: number): {
  wrap: HTMLDivElement;
  bar: HTMLDivElement;
  label: HTMLSpanElement;
  start: () => void;
  stop: () => void;
} {
  const wrap = document.createElement('div');
  wrap.dataset.testid = 'undo-toast-countdown';
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;padding:0 10px 6px 14px;';

  const track = document.createElement('div');
  track.style.cssText = 'flex:1;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;';

  const bar = document.createElement('div');
  bar.dataset.testid = 'undo-toast-countdown-bar';
  bar.style.cssText = 'height:100%;width:100%;background:#c4b5fd;border-radius:2px;' +
    'transition:width ' + String(durationMs) + 'ms linear;';
  track.appendChild(bar);

  const label = document.createElement('span');
  label.dataset.testid = 'undo-toast-countdown-label';
  label.style.cssText = 'font-size:10px;color:#94a3b8;font-variant-numeric:tabular-nums;min-width:22px;text-align:right;';
  label.textContent = Math.ceil(durationMs / 1000) + 's';

  wrap.appendChild(track);
  wrap.appendChild(label);

  let tickId: ReturnType<typeof setInterval> | null = null;
  const startedAt = { t: 0 };
  const start = function(): void {
    startedAt.t = Date.now();
    requestAnimationFrame(function() { bar.style.width = '0%'; });
    tickId = setInterval(function() {
      const remaining = Math.max(0, durationMs - (Date.now() - startedAt.t));
      label.textContent = Math.ceil(remaining / 1000) + 's';
      if (remaining <= 0 && tickId !== null) { clearInterval(tickId); tickId = null; }
    }, 250);
  };
  const stop = function(): void {
    if (tickId !== null) { clearInterval(tickId); tickId = null; }
  };
  return { wrap, bar, label, start, stop };
}

function _buildUndoButton(label: string): HTMLButtonElement {
  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.dataset.testid = 'undo-toast-action';
  undoBtn.textContent = label;
  undoBtn.style.cssText = 'padding:4px 10px;background:transparent;border:1px solid rgba(196,181,253,0.5);' +
    'border-radius:4px;color:#c4b5fd;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;';
  return undoBtn;
}

function _wireUndoAction(
  undoBtn: HTMLButtonElement,
  onUndo: () => void | Promise<void>,
  dismiss: () => void,
): void {
  let consumed = false;
  undoBtn.onclick = function(): void {
    if (consumed) return;
    consumed = true;
    undoBtn.disabled = true;
    undoBtn.textContent = '⏳';
    try {
      const result = onUndo();
      const isPromise = result !== undefined && result !== null && typeof (result as Promise<void>).then === 'function';
      if (isPromise) {
        (result as Promise<void>).catch(function(err) {
          logError('showUndoToast', 'onUndo threw', err);
          showPasteToast('❌ Undo failed: ' + toErrorMessage(err), true);
        }).then(function() { dismiss(); });
      } else {
        dismiss();
      }
    } catch (err) {
      logError('showUndoToast', 'onUndo threw', err);
      showPasteToast('❌ Undo failed: ' + toErrorMessage(err), true);
      dismiss();
    }
  };
  (undoBtn as unknown as { __isConsumed: () => boolean }).__isConsumed = () => consumed;
}

export function showUndoToast(
  message: string,
  onUndo: () => void | Promise<void>,
  opts?: { undoLabel?: string; timeoutMs?: number; restoredId?: number | string },
): void {
  const container = _getOrCreateToastContainer();
  while (container.children.length >= TOAST_MAX_STACK) {
    const oldest = container.lastElementChild;
    if (oldest) oldest.remove();
  }

  const { toast, content, body } = _buildUndoToastShell();

  const text = document.createElement('span');
  text.textContent = message;
  text.style.cssText = 'flex:1;';
  content.appendChild(text);

  if (opts?.restoredId !== undefined && opts.restoredId !== null && String(opts.restoredId) !== '') {
    content.appendChild(_buildIdChip(opts.restoredId));
  }

  const undoBtn = _buildUndoButton(opts?.undoLabel ?? 'Undo');
  const duration = Math.max(500, opts?.timeoutMs ?? 8000);
  const countdown = _buildCountdown(duration);
  const dismiss = function(): void {
    countdown.stop();
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(function() { toast.remove(); }, 250);
  };
  _wireUndoAction(undoBtn, onUndo, dismiss);
  content.appendChild(undoBtn);

  body.appendChild(countdown.wrap);
  container.insertBefore(toast, container.firstChild);

  requestAnimationFrame(function() {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    countdown.start();
  });

  const isConsumed = (undoBtn as unknown as { __isConsumed: () => boolean }).__isConsumed;
  setTimeout(function() {
    if (isConsumed()) return;
    dismiss();
  }, duration);
}








// ── Find editor paste target via XPath/CSS selectors ──
export function findPasteTarget(promptsCfg: PromptsCfg, getByXPath: (xpath: string) => Element | null): Element | null {
  let el: Element | null = null;
  if (promptsCfg.pasteTargetXPath) {
    el = getByXPath(promptsCfg.pasteTargetXPath);
    if (el) return el;
  }
  if (promptsCfg.pasteTargetSelector) {
    el = document.querySelector(promptsCfg.pasteTargetSelector);
    if (el) return el;
  }
  const selectors = [
    'form textarea[placeholder]',
    'div[contenteditable="true"]',
    'textarea.ProseMirror',
    '[data-testid="prompt-input"]'
  ];
  for (const sel of selectors) {
    el = document.querySelector(sel);

    if (el) { return el; }
  }
  return null;
}

// ── Paste/append text into editor element ──
/** Paste into a textarea or input element using native setter. */
function pasteIntoTextarea(target: HTMLElement, text: string): void {
  const currentVal = (target as HTMLInputElement).value || '';
  const newVal = currentVal + (currentVal.length > 0 ? '\n' : '') + text;
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value') ||
                     Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  if (nativeSetter?.set) {
    nativeSetter.set.call(target, newVal);
  } else {
    (target as HTMLInputElement).value = newVal;
  }
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Paste into a contenteditable element using execCommand or DataTransfer fallback. */
function pasteIntoContentEditable(target: HTMLElement, text: string): boolean {
  // Move cursor to end
  const sel = window.getSelection();
  if (sel) {
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const existingText = (target.textContent || '').trim();
  const prefix = existingText.length > 0 ? '\n' : '';
  const fullText = prefix + text;

  const execResult = document.execCommand('insertText', false, fullText);
  if (execResult) {
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: fullText }));
    return true;
  }

  // Fallback: DataTransfer paste
  log('Prompt inject: execCommand failed, trying DataTransfer paste', 'warn');
  const dt = new DataTransfer();
  dt.setData('text/plain', fullText);
  const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  const pasteHandled = target.dispatchEvent(pasteEvent);

  if (pasteHandled) {
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: fullText }));
    return true;
  }

  // Last resort: clipboard
  log('Prompt inject: DataTransfer paste also failed, using clipboard API', 'warn');
  navigator.clipboard.writeText(text).then(function() {
    showPasteToast('📋 Copied to clipboard — paste with Ctrl+V', false);
  });
  return false;
}

export type PasteOutcome = 'injected' | 'clipboard' | 'failed' | 'cancelled';

/**
 * Scan text for {{?Variable Name}} and prompt user for values.
 */
export async function resolveDynamicVariables(text: string): Promise<string | null> {
  const variableRegex = /\{\{\?([^}]+)\}\}/g;
  const matches = Array.from(text.matchAll(variableRegex));
  
  if (matches.length === 0) return text;

  // Deduplicate variables
  const uniqueVars = Array.from(new Set(matches.map(m => m[1].trim())));
  
  // Show input modal
  const values = await showVariableInputModal(uniqueVars);
  if (!values) return null; // User cancelled

  let resolvedText = text;
  uniqueVars.forEach(v => {
    const escapedVar = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{\\?\\s*${escapedVar}\\s*\\}\\}`, 'g');
    resolvedText = resolvedText.replace(regex, values[v] || '');
  });

  return resolvedText;
}

/**
 * Show a simple modal to collect variable values.
 */
function showVariableInputModal(vars: string[]): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:2147483647;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-family:system-ui,-apple-system,sans-serif;';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1e1e2e;border:1px solid #313147;border-radius:12px;width:400px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:12px;';
    
    const header = document.createElement('div');
    header.style.cssText = 'font-size:14px;font-weight:700;color:#3daee9;margin-bottom:8px;';
    header.textContent = 'Variables Required';
    modal.appendChild(header);

    const inputs: Record<string, HTMLInputElement> = {};
    
    vars.forEach(v => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      
      const label = document.createElement('label');
      label.textContent = v;
      label.style.cssText = 'font-size:11px;color:#94a3b8;font-weight:600;';
      row.appendChild(label);
      
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = `Enter value for ${v}...`;
      input.style.cssText = 'background:#252536;border:1px solid #313147;border-radius:6px;padding:8px 10px;color:#fff;font-size:12px;outline:none;';
      input.onfocus = () => input.style.borderColor = '#007acc';
      input.onblur = () => input.style.borderColor = '#313147';
      
      row.appendChild(input);
      modal.appendChild(row);
      inputs[v] = input;
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 12px;font-size:12px;background:transparent;border:1px solid #313147;color:#94a3b8;border-radius:6px;cursor:pointer;';
    cancelBtn.onclick = () => { overlay.remove(); resolve(null); };
    
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Inject Prompt';
    submitBtn.style.cssText = 'padding:6px 16px;font-size:12px;background:#007acc;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;';
    submitBtn.onclick = () => {
      const results: Record<string, string> = {};
      vars.forEach(v => results[v] = inputs[v].value.trim());
      overlay.remove();
      resolve(results);
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);
    modal.appendChild(footer);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Focus first input
    const firstVar = vars[0];
    if (firstVar) inputs[firstVar].focus();

    // Enter to submit
    overlay.onkeydown = (e) => {
      if (e.key === 'Enter') submitBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    };
  });
}

export async function pasteIntoEditor(rawText: string, promptsCfg: PromptsCfg, getByXPath: (xpath: string) => Element | null, captureSource: 'paste' | 'next-chip' | 'plan-chip' = 'paste'): Promise<PasteOutcome> {
  // 1. Handle date/time (legacy)
  const now = new Date();
  let text = rawText
    .replace(/\{\{date\}\}/gi, now.toLocaleDateString())
    .replace(/\{\{time\}\}/gi, now.toLocaleTimeString());

  // 2. Handle dynamic variables
  const resolved = await resolveDynamicVariables(text);
  if (resolved === null) return 'cancelled';
  text = normalizeNewlines(resolved);

  const target = findPasteTarget(promptsCfg, getByXPath) as HTMLElement | null;

  if (!target) {
    log('Prompt paste: No editor target found — copying to clipboard instead', 'warn');
    navigator.clipboard.writeText(text).then(function() {
      log('Prompt copied to clipboard (no paste target)', 'success');
      showPasteToast('📋 Copied to clipboard — paste manually with Ctrl+V', false);
    }).catch(function() {
      showPasteToast('❌ Could not paste or copy — editor target not found', true);
    });
    return 'clipboard';
  }

  log('Prompt inject: target found (' + target.tagName + ', contentEditable=' + target.contentEditable + '), text length=' + text.length, 'info');

  try {
    target.focus();
    const isTextInput = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';

    if (isTextInput) {
      pasteIntoTextarea(target, text);
    } else {
      const ok = pasteIntoContentEditable(target, text);
      if (!ok) return 'failed';
    }

    log('Prompt injected: "' + text.substring(0, 80) + '..." (' + text.length + ' total chars)', 'success');
    showPasteToast('✓ Prompt injected (' + text.length + ' chars)', false);
    void capturePasteSubmit(text, captureSource);
    return 'injected';
  } catch (e: unknown) {
    const errMsg = toErrorMessage(e);
    logError('Prompt inject failed', '' + errMsg);
    navigator.clipboard.writeText(text).then(function() {
      showPasteToast('⚠️ Inject failed — copied to clipboard, try Ctrl+V', true);
    }).catch(function(e: unknown) {
      logError('copyPrompt', 'Prompt copy to clipboard failed', e);
      showToast('❌ Prompt copy to clipboard failed', 'error');
      showPasteToast('❌ Inject and clipboard both failed', true);
    });
    return 'failed';
  }
}

/**
 * Setup capture for prompt text box to sync with IndexedDB and SQLite.
 */
export function setupPromptCapture(promptsCfg: PromptsCfg, getByXPath: (xpath: string) => Element | null): void {
  log('Prompt Capture: Initializing...', 'info');
  
  // Throttle helper
  let timer: number | null = null;
  const throttleSave = (text: string) => {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const projectId = extractProjectIdFromUrl();
      if (!projectId) return;
      
      // 1. Save to IndexedDB
      const store = getProjectKvStore('macro-controller');
      await store.set('last_prompt_capture', projectId, { text, timestamp: Date.now() });
      
      // 2. Sync to SQLite
      await saveCommunication(projectId, text);
      logSub('Captured prompt synced to DB', 1);
    }, 2000);
  };

  // Poll for target periodically since it may be unmounted/remounted in SPA
  setInterval(() => {
    const target = findPasteTarget(promptsCfg, getByXPath) as HTMLElement | null;
    const capturedTarget = target as HTMLElement & { __captured?: boolean };
    if (capturedTarget && !capturedTarget.__captured) {
      capturedTarget.__captured = true;
      const isInput = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
      const eventType = isInput ? 'input' : 'input'; // both use input for content changes
      
      target?.addEventListener(eventType, () => {
        const text = isInput ? (target as HTMLInputElement).value : target?.textContent || '';
        if (text.trim().length > 2) {
          throttleSave(text.trim());
        }
      });
      log('Prompt Capture: Attached to editor target', 'success');
    }
  }, 3000);
}

/**
 * Sync logic: subtle visual confirmation on status indicator.
 */
export async function visualSyncConfirm(): Promise<void> {
  const dot = document.querySelector('#marco-queue-status span[style*="color"]');
  if (dot) {
    const origColor = (dot as HTMLElement).style.color;
    (dot as HTMLElement).style.color = '#3daee9'; // light blue sync color
    (dot as HTMLElement).style.transform = 'scale(1.4)';
    (dot as HTMLElement).style.transition = 'all 0.3s ease';
    
    setTimeout(() => {
      (dot as HTMLElement).style.color = origColor;
      (dot as HTMLElement).style.transform = 'scale(1)';
    }, 800);
  }
}

