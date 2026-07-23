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

function markBusy(element: HTMLElement, opts: GuardOptions): { restore: () => void } {
  const prevAria = element.getAttribute('aria-busy');
  const prevDisabled = (element as HTMLButtonElement).disabled;
  const prevText = opts.spinner ? element.textContent : null;
  element.setAttribute(BUSY_ATTR, '1');
  element.setAttribute('aria-busy', 'true');
  if ('disabled' in element) (element as HTMLButtonElement).disabled = true;
  element.style.opacity = '0.6';
  element.style.pointerEvents = 'none';
  if (opts.spinner && prevText !== null) {
    element.textContent = opts.spinner + ' ' + prevText;
  }
  return {
    restore(): void {
      element.removeAttribute(BUSY_ATTR);
      if (prevAria === null) element.removeAttribute('aria-busy'); else element.setAttribute('aria-busy', prevAria);
      if ('disabled' in element) (element as HTMLButtonElement).disabled = prevDisabled;
      element.style.opacity = '';
      element.style.pointerEvents = '';
      if (opts.spinner && prevText !== null) element.textContent = prevText;
    },
  };
}

/**
 * Wrap an async click handler. Re-entrant clicks while the handler is running
 * are silently ignored (they would otherwise race the DB bridge retry loop).
 */
export function guardAsyncClick(
  element: HTMLElement,
  handler: () => Promise<void> | void,
  opts: GuardOptions = {},
): () => Promise<void> {
  return async function guarded(): Promise<void> {
    if (element.getAttribute(BUSY_ATTR) === '1') return;
    const { restore } = markBusy(element, opts);
    try {
      await handler();
    } finally {
      restore();
    }
  };
}

export function isBusy(element: HTMLElement): boolean {
  return element.getAttribute(BUSY_ATTR) === '1';
}
