/**
 * Inline strips frame — single container that hosts Plan, Next, and Repeat
 * strips as one visual unit above the Lovable chat textarea.
 *
 * Ownership: this module owns the outer frame DOM only. Each strip module
 * (`next-inline-ui.ts`, `repeat-loop-ui.ts`) still builds its own row and
 * inserts it into `frame.body` via `ensureInlineStripsFrame()`.
 *
 * The frame's header (label + minimize chevron + explicit remove ×) is wired
 * to `inline-strip-group-collapse.ts` in step 3 of the plan
 * `.lovable/plans/pending/11-unified-strip-frame-and-persistence.md`.
 *
 * Step 2: container + header DOM only. Chevron/× click behavior + persistence
 * of `removed` flag land in step 3/4.
 */

import { log } from '../logger';
import { VERSION } from '../shared-state';
import {
  toggleInlineStripGroupCollapsed,
  getInlineStripGroupCollapsed,
  applyInlineStripGroupCollapse,
  subscribeInlineStripGroupCollapse,
  getInlineStripGroupRemoved,
  setInlineStripGroupRemoved,
} from './inline-strip-group-collapse';

export const FRAME_ID = 'marco-inline-strips-frame';
export const FRAME_BODY_ID = 'marco-inline-strips-frame-body';
export const FRAME_HEADER_ID = 'marco-inline-strips-frame-header';
export const FRAME_CHEVRON_ID = 'marco-inline-strips-frame-chevron';
export const FRAME_REMOVE_ID = 'marco-inline-strips-frame-remove';
export const FRAME_RESTORE_ID = 'marco-inline-strips-frame-restore';

const FRAME_CSS = [
  'display:flex',
  'flex-direction:column',
  'gap:0',
  'margin:6px 0 4px',
  'padding:4px 6px 6px',
  'border:1px solid rgba(255,255,255,0.10)',
  'border-radius:8px',
  'background:rgba(255,255,255,0.02)',
].join(';');

const HEADER_CSS = [
  'display:flex',
  'align-items:center',
  'justify-content:space-between',
  'gap:6px',
  'padding:2px 2px 4px',
  'font-size:10px',
  'opacity:0.75',
  'user-select:none',
].join(';');

const BODY_CSS = [
  'display:flex',
  'flex-direction:column',
  'gap:4px',
].join(';');

const BTN_CSS = [
  'background:transparent',
  'color:inherit',
  'border:1px solid rgba(255,255,255,0.15)',
  'border-radius:4px',
  'padding:1px 6px',
  'font-size:11px',
  'cursor:pointer',
  'line-height:1',
].join(';');

const RESTORE_BTN_CSS = [
  'background:rgba(124,58,237,0.25)',
  'color:#e9d5ff',
  'border:1px solid rgba(124,58,237,0.6)',
  'border-radius:4px',
  'padding:2px 8px',
  'font-size:11px',
  'font-weight:600',
  'cursor:pointer',
  'line-height:1',
].join(';');

function applyHiddenState(hidden: boolean): void {
  const frame = document.getElementById(FRAME_ID);
  const body = document.getElementById(FRAME_BODY_ID);
  const chevron = document.getElementById(FRAME_CHEVRON_ID);
  const remove = document.getElementById(FRAME_REMOVE_ID);
  const restore = document.getElementById(FRAME_RESTORE_ID);
  if (!frame || !body || !chevron || !remove || !restore) return;
  if (hidden) {
    frame.dataset.hidden = '1';
    body.style.display = 'none';
    chevron.style.display = 'none';
    remove.style.display = 'none';
    restore.style.display = 'inline-flex';
  } else {
    frame.dataset.hidden = '0';
    body.style.display = getInlineStripGroupCollapsed() ? 'none' : 'flex';
    chevron.style.display = 'inline-flex';
    remove.style.display = 'inline-flex';
    restore.style.display = 'none';
  }
}

function buildHeader(): HTMLDivElement {
  const header = document.createElement('div');
  header.id = FRAME_HEADER_ID;
  header.style.cssText = HEADER_CSS;

  const label = document.createElement('span');
  label.textContent = `Marco inline v${VERSION} (Plan / Next / Repeat)`;
  label.title = `Marco extension v${VERSION}`;
  header.appendChild(label);

  const actions = document.createElement('span');
  actions.style.cssText = 'display:inline-flex;gap:4px;align-items:center;';

  // Restore button — visible only when the strips are hidden via ×.
  const restore = document.createElement('button');
  restore.type = 'button';
  restore.id = FRAME_RESTORE_ID;
  restore.style.cssText = RESTORE_BTN_CSS + ';display:none;';
  restore.title = 'Restore Plan, Next, Repeat strips';
  restore.textContent = '↻ Restore inline strips';
  restore.onclick = function (): void {
    setInlineStripGroupRemoved(false);
    applyHiddenState(false);
    log('InlineStripsFrame: user restored strips via header button', 'info');
  };
  actions.appendChild(restore);

  const chevron = document.createElement('button');
  chevron.type = 'button';
  chevron.id = FRAME_CHEVRON_ID;
  chevron.style.cssText = BTN_CSS;
  chevron.title = 'Minimize / maximize Plan, Next, Repeat';
  chevron.textContent = getInlineStripGroupCollapsed() ? '+' : '−';
  chevron.onclick = function (): void {
    toggleInlineStripGroupCollapsed();
  };
  actions.appendChild(chevron);

  // × hides the body and swaps the header to show a Restore button.
  // Session-only (see inline-strip-group-collapse.ts hydrate note).
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.id = FRAME_REMOVE_ID;
  remove.style.cssText = BTN_CSS;
  remove.title = 'Hide Plan / Next / Repeat strips (Restore button appears in header)';
  remove.textContent = '×';
  remove.onclick = function (): void {
    setInlineStripGroupRemoved(true);
    applyHiddenState(true);
    log('InlineStripsFrame: user hid strips via ×; Restore button now visible', 'info');
  };
  actions.appendChild(remove);

  header.appendChild(actions);
  return header;
}

function buildFrame(): HTMLDivElement {
  const frame = document.createElement('div');
  frame.id = FRAME_ID;
  frame.style.cssText = FRAME_CSS;

  const header = buildHeader();
  const body = document.createElement('div');
  body.id = FRAME_BODY_ID;
  body.style.cssText = BODY_CSS;

  frame.appendChild(header);
  frame.appendChild(body);
  return frame;
}

/**
 * Ensure the frame exists as a sibling BEFORE `formHost` inside
 * `formHost.parentElement`. Returns the frame + its body element. Callers
 * append their strip row to `body` instead of anchoring against the form
 * directly.
 *
 * Idempotent: if the frame is already mounted, returns the existing one.
 * Also self-heals if the frame got detached (SPA rerender) by re-inserting.
 */
export function ensureInlineStripsFrame(formHost: HTMLElement): {
  frame: HTMLElement;
  body: HTMLElement;
} | null {
  const parent = formHost.parentElement;
  if (!parent) {
    log('InlineStripsFrame: form host has no parent — cannot mount frame', 'warn');
    return null;
  }

  let frame = document.getElementById(FRAME_ID) as HTMLElement | null;
  if (frame && !parent.contains(frame)) {
    // Detached (SPA rerender) — reinsert at correct anchor.
    parent.insertBefore(frame, formHost);
  }

  if (!frame) {
    frame = buildFrame();
    parent.insertBefore(frame, formHost);
    // Re-apply group collapse when it toggles so body visibility stays synced.
    subscribeInlineStripGroupCollapse(function (): void {
      applyInlineStripGroupCollapse();
      const chevron = document.getElementById(FRAME_CHEVRON_ID);
      if (chevron) chevron.textContent = getInlineStripGroupCollapsed() ? '+' : '−';
      const body = document.getElementById(FRAME_BODY_ID);
      if (body && frame && frame.dataset.hidden !== '1') {
        body.style.display = getInlineStripGroupCollapsed() ? 'none' : 'flex';
      }
    });
    log('InlineStripsFrame: unified frame mounted above chat box', 'info');
  }

  const body = document.getElementById(FRAME_BODY_ID) as HTMLElement | null;
  if (!body) {
    log('InlineStripsFrame: body element missing after mount — DOM corrupted', 'error');
    return null;
  }

  // Apply hidden state (× toggle) — frame stays mounted so Restore button
  // remains reachable in the header even when strips are hidden.
  applyHiddenState(getInlineStripGroupRemoved());

  return { frame, body };
}

/**
 * Clear the persisted `removed` flag so the next mount attempt re-creates the
 * frame. Called by the TS Macro panel menu action "Restore inline strips".
 */
export function restoreInlineStripsFrame(): void {
  setInlineStripGroupRemoved(false);
  log('InlineStripsFrame: restore requested; next mount attempt will re-create frame', 'info');
}
