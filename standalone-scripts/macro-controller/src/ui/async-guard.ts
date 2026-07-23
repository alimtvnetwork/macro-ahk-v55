/**
 * async-guard: absorb rapid re-entrant clicks on async chip / button handlers.
 *
 * The Next chip, Plan chip, and prompt-editor Save all fire DB-fallback flows
 * via `runWithBridgeRetry`. If the user double-clicks while a retry is in
 * flight, the second call can hit a stale cached method and surface
 * PROMPT_LOAD_E001 / PROMPT_EDIT_E005 to the user even though the first call
 * is about to succeed. This helper serialises the handler on the element,
 * marks it busy for CSS/AT, and drops overlapping invocations.
 */

const BUSY_ATTR = 'data-marco-busy';

export interface GuardOptions {
  /** Optional spinner glyph inserted while the handler is running. */
  readonly spinner?: string;
}

function markBusy(el: HTMLElement, opts: GuardOptions): { restore: () => void } {
  const prevAria = el.getAttribute('aria-busy');
  const prevDisabled = (el as HTMLButtonElement).disabled;
  const prevText = opts.spinner ? el.textContent : null;
  el.setAttribute(BUSY_ATTR, '1');
  el.setAttribute('aria-busy', 'true');
  if ('disabled' in el) (el as HTMLButtonElement).disabled = true;
  el.style.opacity = '0.6';
  el.style.pointerEvents = 'none';
  if (opts.spinner && prevText !== null) {
    el.textContent = opts.spinner + ' ' + prevText;
  }
  return {
    restore(): void {
      el.removeAttribute(BUSY_ATTR);
      if (prevAria === null) el.removeAttribute('aria-busy'); else el.setAttribute('aria-busy', prevAria);
      if ('disabled' in el) (el as HTMLButtonElement).disabled = prevDisabled;
      el.style.opacity = '';
      el.style.pointerEvents = '';
      if (opts.spinner && prevText !== null) el.textContent = prevText;
    },
  };
}

/**
 * Wrap an async click handler. Re-entrant clicks while the handler is running
 * are silently ignored (they would otherwise race the DB bridge retry loop).
 */
export function guardAsyncClick(
  el: HTMLElement,
  handler: () => Promise<void> | void,
  opts: GuardOptions = {},
): () => Promise<void> {
  return async function guarded(): Promise<void> {
    if (el.getAttribute(BUSY_ATTR) === '1') return;
    const { restore } = markBusy(el, opts);
    try {
      await handler();
    } finally {
      restore();
    }
  };
}

export function isBusy(el: HTMLElement): boolean {
  return el.getAttribute(BUSY_ATTR) === '1';
}
