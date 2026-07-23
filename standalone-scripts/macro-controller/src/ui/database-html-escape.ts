/**
 * MacroLoop Controller — HTML escape leaf.
 *
 * Plan-17 step 16: extracted from `database-data-table.ts` to break the
 * `database-modal-data → database-data-filter → database-data-table
 *  → database-modal-data` runtime cycle (madge circular #11).
 *
 * Pure function, no imports. Depend on this file, never on data-table,
 * when the only need is escaping. Uses the DOM textContent → innerHTML
 * round-trip so the browser produces canonical entity encoding.
 */
export function escapeHtml(text: string): string {
  const container = document.createElement('div');
  container.textContent = text;
  return container.innerHTML;
}
