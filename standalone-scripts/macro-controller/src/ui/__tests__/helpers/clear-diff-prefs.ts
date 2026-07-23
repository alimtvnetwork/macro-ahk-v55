/**
 * Shared test helper: clear every localStorage key related to diff-pane
 * preferences.
 *
 * Diff toggle state persists under the `marco.diffOpen.<role>` namespace
 * (v4.192.0). If a test leaves any of those keys populated, the next test's
 * `openPromptEditor(...)` will hydrate a pre-open diff pane and its toggle
 * click will close instead of open, producing spurious failures like
 * `expected [] to include 'add'` (seen in v4.242.0 -> v4.245.0).
 *
 * Prefer this helper over ad-hoc `window.localStorage.clear()` inside diff
 * tests: it documents intent, targets the exact prefix, and stays byte-stable
 * if unrelated keys are ever introduced by other suites running in the same
 * jsdom instance.
 */

export const DIFF_PREF_PREFIX = 'marco.diffOpen.';

/**
 * Remove every `marco.diffOpen.<role>` entry from `window.localStorage`.
 * Safe to call in any `beforeEach` / `afterEach`; no-op when storage is empty.
 */
export function clearDiffPrefs(): void {
  const storage = window.localStorage;
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(DIFF_PREF_PREFIX)) {
      doomed.push(key);
    }
  }
  for (const key of doomed) {
    storage.removeItem(key);
  }
}
