/**
 * Prompt Dropdown Header cluster
 *
 * Plan-17 Step 26: extracted from ui/prompt-dropdown.ts to keep that file
 * under the 500 LOC guideline cap. Owns the sticky header row (Plan marker,
 * hidden Next marker, Library / Export / Import / IO / Load pills).
 *
 * Accepts a `rerender` callback so we never import back into prompt-dropdown
 * (would recreate the cycle we spent Steps 5-22 killing).
 */

import { log } from '../logger';
import { logError } from '../error-utils';
import { cPrimary, cPrimaryLight } from '../shared-state';
import { forceLoadFromDb } from './prompt-loader';
import type { PromptContext } from './prompt-loader';
import type { TaskNextDeps } from './task-next-ui';
import { buildHeaderPill, buildImportExportButton } from './prompt-dropdown-io';
import { resetPromptOrderToDefault } from './prompt-drag-order';
import { buildPromptOrderIndicator } from './prompt-order-indicator';

export type Rerender = () => void;

/** Build the sticky dropdown header (left markers + right action pills). */
export function buildDropdownHeader(
  promptCtx: PromptContext,
  taskNextDeps: TaskNextDeps,
  rerender: Rerender,
): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = 'position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 8px;border-bottom:1px solid #7c3aed;background:#1a0b2e;';
  const left = document.createElement('div');
  left.style.cssText = 'display:flex;align-items:center;gap:2px;';
  left.appendChild(buildPlanTabMarker());
  left.appendChild(buildHiddenNextCompatibilityMarker());
  left.appendChild(buildPromptOrderIndicator());
  header.appendChild(left);
  const right = document.createElement('div');
  right.style.cssText = 'display:flex;align-items:center;gap:6px;';
  right.appendChild(buildLibraryButton());
  right.appendChild(buildReadMemoryAdminButton());
  // v4.402.0: single consolidated Prompts I/O button (submenu) replaces the
  // three separate Export / Import / IO pills. Legacy builders remain
  // exported for tests + direct callers.
  right.appendChild(buildImportExportButton(rerender));
  void promptCtx; void taskNextDeps;
  right.appendChild(buildResetOrderButton(rerender));
  right.appendChild(buildLoadButton(rerender));
  header.appendChild(right);
  return header;
}

/** Launcher for the Read Memory admin screen (view + deactivate duplicates). */
function buildReadMemoryAdminButton(): HTMLElement {
  return buildHeaderPill('🛡 RM Admin', 'View and deactivate Read Memory prompt duplicates', function(e: Event) {
    e.stopPropagation();
    void import('./read-memory-admin-modal').then(function(mod) {
      void (mod as { openReadMemoryAdminModal: () => Promise<void> }).openReadMemoryAdminModal();
    });
  });
}



/** Plan-14 step 10 launcher: opens the DB-backed Prompt Library modal. */
function buildLibraryButton(): HTMLElement {
  return buildHeaderPill('🗂 Library', 'Open Prompt Library (edit / duplicate / delete)', function(e: Event) {
    e.stopPropagation();
    void import('./prompt-library-modal').then(function(mod) {
      (mod as { openPromptLibraryModal: () => Promise<void> }).openPromptLibraryModal();
    });
  });
}

/**
 * Hidden legacy marker for old CI/test bundles that still query
 * `[data-next-toggle]`. The Next UI itself stays in the inline strip, not in
 * the dropdown header, so this element is never visible or interactive.
 */
function buildHiddenNextCompatibilityMarker(): HTMLElement {
  const marker = document.createElement('span');
  marker.setAttribute('data-next-toggle', '1');
  marker.setAttribute('data-tab-active', '0');
  marker.setAttribute('aria-hidden', 'true');
  marker.textContent = 'Next';
  marker.style.cssText = 'display:none;';
  return marker;
}

/**
 * Legacy Plan tab marker retained for CI/tests and back-compat. The Plan
 * feature itself lives inline, so this element is a lightweight label only.
 */
function buildPlanTabMarker(): HTMLElement {
  const marker = document.createElement('span');
  marker.setAttribute('data-plan-toggle', '1');
  marker.setAttribute('data-tab-active', '1');
  marker.textContent = 'Plan';
  marker.style.cssText = 'font-size:10px;color:' + cPrimaryLight + ';padding:2px 6px;';
  return marker;
}




/** Build the "↺ Reset to default order" pill that restores DEFAULT_PROMPT_ORDER. */
function buildResetOrderButton(rerender: Rerender): HTMLElement {
  return buildHeaderPill('↺ Reset to default order', 'Clear saved drag order and restore the canonical DEFAULT_PROMPT_ORDER sequence', function(e: Event) {
    e.stopPropagation();
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm('Reset prompt ordering to the built-in default? Your saved drag order will be cleared.')
      : true;
    if (!ok) return;
    try {
      const restored = resetPromptOrderToDefault();
      log('[PromptDropdown] Prompt order reset to DEFAULT_PROMPT_ORDER (' + restored.length + ' slugs)', 'success');
      void import('../toast').then(function(mod) {
        const showToast = (mod as { showToast?: (message: string, kind?: string) => void }).showToast;
        if (showToast) showToast('↺ Prompt order reset to default', 'success');
      }).catch(function() { /* toast optional */ });
      rerender();
    } catch (err) {
      logError('PromptDropdown', 'Reset order failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  });
}

/** Build the manual "Load" button for refreshing prompts from DB. */
function buildLoadButton(rerender: Rerender): HTMLElement {
  const btn = document.createElement('span');
  btn.textContent = '↻ Load';
  btn.title = 'Reload prompts from database';
  btn.style.cssText = 'cursor:pointer;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:600;color:#fff;background:' + cPrimary + ';border:1px solid rgba(255,255,255,0.1);';
  btn.onmouseover = function() { btn.style.background = cPrimaryLight; btn.style.transform = 'scale(1.05)'; };
  btn.onmouseout = function() { btn.style.background = cPrimary; btn.style.transform = ''; };
  btn.onclick = function(e: Event) {
    e.stopPropagation();
    handleLoadClick(btn, rerender);
  };
  return btn;
}

/** Handle the Load button click, fetch from DB and re-render. */
function handleLoadClick(btn: HTMLElement, rerender: Rerender): void {
  btn.textContent = '⏳…';
  btn.style.pointerEvents = 'none';
  forceLoadFromDb().then(function() {
    log('[PromptDropdown] Manual load complete, re-rendering', 'success');
    rerender();
  }).catch(function(err: unknown) {
    logError('PromptDropdown', 'Manual load failed: ' + (err instanceof Error ? err.message : String(err)));
    btn.textContent = '↻ Load';
    btn.style.pointerEvents = '';
  });
}

