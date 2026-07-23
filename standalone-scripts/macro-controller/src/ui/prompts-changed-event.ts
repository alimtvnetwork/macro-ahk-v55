/**
 * Cross-module notification that the Prompt table changed on disk.
 *
 * Dispatched by:
 *   - `refreshAfterPromptSave` (prompt-injection.ts)     — editor Save
 *   - `setActive` / `deleteCustom` (chip-gear-menu.ts)   — picker actions
 *   - Successful Import commit (prompt-dropdown-io.ts)   — bulk import
 *
 * Subscribed by:
 *   - The Next inline strip (next-inline-ui.ts) so the numbered chips
 *     refresh their DB-backed values without a full page reload.
 *   - Any future surface that shows role-scoped prompt lists (empty-state
 *     minus-button visibility, etc.).
 */

export const PROMPTS_CHANGED_EVENT = 'marco:prompts-changed' as const;

export interface PromptsChangedDetail {
  readonly role?: string;
  readonly reason?: string;
}

export function dispatchPromptsChanged(detail: PromptsChangedDetail = {}): void {
  if (typeof document === 'undefined') return;
  try {
    document.dispatchEvent(new CustomEvent(PROMPTS_CHANGED_EVENT, { detail }));
  } catch {
    // Older jsdom environments without CustomEvent fall back to a plain Event.
    try { document.dispatchEvent(new Event(PROMPTS_CHANGED_EVENT)); } catch { /* noop */ }
  }
}

export function subscribePromptsChanged(handler: (detail: PromptsChangedDetail) => void): () => void {
  if (typeof document === 'undefined') return function() { /* noop */ };
  const listener = function(ev: Event): void {
    const detail = (ev as CustomEvent<PromptsChangedDetail>).detail ?? {};
    handler(detail);
  };
  document.addEventListener(PROMPTS_CHANGED_EVENT, listener);
  return function() { document.removeEventListener(PROMPTS_CHANGED_EVENT, listener); };
}