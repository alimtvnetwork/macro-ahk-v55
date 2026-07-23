/**
 * Prompt drag-and-drop reordering.
 *
 * Persists user-defined ordering as an array of prompt slugs in localStorage
 * under `marco.promptOrder.v1`. Entries without a saved position are kept in
 * their original relative order after the saved ones.
 *
 * v4.388.0: Added `DEFAULT_PROMPT_ORDER` so first-run users see a curated
 * ordering (Read + Write + Release as the final three prompts) before drag
 * anything. Also exposes helpers to snapshot / restore the order as part
 * of the JSON export/import bundle.
 */

import type { PromptEntry } from '../types';

const STORAGE_KEY = 'marco.promptOrder.v2';
const DRAG_TOUCHED_KEY = 'marco.promptOrder.dragTouched.v2';
const LEGACY_STORAGE_KEYS = ['marco.promptOrder.v1'] as const;
const MIGRATION_REV_KEY = 'marco.promptOrder.rev';
/**
 * Bump this whenever DEFAULT_PROMPT_ORDER's terminal sequence or canonical
 * slug list changes materially. `runPromptOrderMigrations` will rewrite each
 * user's saved order in-place instead of purging via a fresh STORAGE_KEY.
 */
const CURRENT_MIGRATION_REV = 4;

runPromptOrderMigrations();

/**
 * Upgrade any older persisted order to the current DEFAULT_PROMPT_ORDER
 * shape without discarding user customizations. Runs once per version bump
 * (gated by `MIGRATION_REV_KEY`). Safe to call repeatedly.
 */
function runPromptOrderMigrations(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const storedRev = Number(localStorage.getItem(MIGRATION_REV_KEY) ?? '0');
    if (Number.isFinite(storedRev) && storedRev >= CURRENT_MIGRATION_REV) return;
    const legacy = readLegacyOrder();
    const current = loadPromptOrder();
    const source = current.length > 0 ? current : legacy;
    const migrated = migrateSavedOrder(source);
    if (migrated.length > 0) savePromptOrder(migrated);
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
    localStorage.setItem(MIGRATION_REV_KEY, String(CURRENT_MIGRATION_REV));
  } catch {
    /* localStorage unavailable or JSON malformed; keep whatever is there */
  }
}

function readLegacyOrder(): string[] {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string');
      }
    } catch { /* try next key */ }
  }
  return [];
}

/**
 * Rewrite a saved order so it complies with the current DEFAULT_PROMPT_ORDER
 * contract: unknown slugs are dropped, missing canonical slugs are added at
 * their natural position, and the terminal 7 sequence is forced to match
 * DEFAULT_PROMPT_ORDER's tail exactly.
 */
export function migrateSavedOrder(saved: readonly string[]): string[] {
  const defaults = DEFAULT_PROMPT_ORDER.slice();
  const terminalCount = 7;
  const terminal = defaults.slice(defaults.length - terminalCount);
  const terminalSet = new Set(terminal);
  const defaultSet = new Set(defaults);
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const slug of saved) {
    if (seen.has(slug)) continue;
    if (terminalSet.has(slug)) continue;      // terminal 7 are re-appended below
    if (!defaultSet.has(slug)) continue;      // drop unknown / obsolete slugs
    seen.add(slug);
    kept.push(slug);
  }
  for (const slug of defaults.slice(0, defaults.length - terminalCount)) {
    if (!seen.has(slug)) { kept.push(slug); seen.add(slug); }
  }
  return [...kept, ...terminal];
}


/**
 * Canonical default ordering for built-in prompts.
 *
 * Requirement (v4.388.0): Read Memory, Write Memory, and Release must be
 * the final three prompts in that exact order, with Release as the very last
 * item. Anything not listed here retains its natural (Order-based)
 * position after the listed slugs.
 */
export const DEFAULT_PROMPT_ORDER: readonly string[] = [
  'unified-ai-prompt-v4',
  'issues-tracking',
  'minor-bump',
  'major-bump',
  'patch-bump',
  'code-coverage-basic',
  'code-coverage-details',
  'next-steps',
  'plan-steps',
  'unit-test-issues-v2-enhanced',
  'logo-create',
  'lowercase-readme-and-sequence',
  'pending-tasks',
  'jokes-ideas-generate',
  'improve-spec-from-audit',
  'improve-recent-work-from-audit',
  'recent-work-audit',
  'folder-structure',
  'ambiguity-handling',
  'question-explain',
  'visual-design-proposal',
  'coding-guidelines',
  // Final seven items (locked order):
  'proofread',
  'conversation-log',
  'app-spec-audit',
  'read-memory-enhanced',
  'write-memory',
  'insults-explain',
  'release',
];

export function loadPromptOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function savePromptOrder(order: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* storage may be full or blocked; ignore */
  }
}

/**
 * Reset the persisted order back to `DEFAULT_PROMPT_ORDER`. Called from the
 * gear menu's "Reset default order" action. Returns the applied order so
 * callers can pass it straight into `sortEntriesByOrder`.
 */
export function resetPromptOrderToDefault(): string[] {
  const copy = DEFAULT_PROMPT_ORDER.slice();
  savePromptOrder(copy);
  clearDragTouched();
  return copy;
}

/** Slugs the user has explicitly moved via drag-and-drop. */
function loadDragTouched(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(DRAG_TOUCHED_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveDragTouched(set: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DRAG_TOUCHED_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

function clearDragTouched(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(DRAG_TOUCHED_KEY);
  } catch { /* ignore */ }
}

export type SlugPositionSource = 'default' | 'migrated' | 'drag';

export interface SlugPositionInfo {
  source: SlugPositionSource;
  storageKey: string;
  migrationRev: number;
  currentRev: number;
  index: number;
}

/**
 * Classify why a given slug sits at its current position:
 *   - `drag`: user moved it via drag-and-drop in this or a prior session.
 *   - `migrated`: position came from a saved order that survived a migration.
 *   - `default`: no saved order applies; falling back to DEFAULT_PROMPT_ORDER.
 */
export function getSlugPositionSource(slug: string): SlugPositionInfo {
  const saved = loadPromptOrder();
  const touched = loadDragTouched();
  let migrationRev = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      migrationRev = Number(localStorage.getItem(MIGRATION_REV_KEY) ?? '0') || 0;
    }
  } catch { /* ignore */ }
  const effective = saved.length > 0 ? saved : DEFAULT_PROMPT_ORDER.slice();
  const index = effective.indexOf(slug);
  let source: SlugPositionSource;
  if (saved.length === 0 || index < 0) source = 'default';
  else if (touched.has(slug)) source = 'drag';
  else source = 'migrated';
  return { source, storageKey: STORAGE_KEY, migrationRev, currentRev: CURRENT_MIGRATION_REV, index };
}

/**
 * The order the UI will actually apply: user-saved order if present,
 * otherwise the canonical default. Exposed so the export bundle can carry
 * whatever the user currently sees.
 */
export function getEffectivePromptOrder(): string[] {
  const saved = loadPromptOrder();
  return saved.length > 0 ? saved : DEFAULT_PROMPT_ORDER.slice();
}

export interface PromptOrderSource {
  source: 'localStorage' | 'default';
  storageKey: string;
  migrationRev: number;
  currentRev: number;
  count: number;
}

/** Diagnostic snapshot describing where the effective order came from. */
export function getPromptOrderSource(): PromptOrderSource {
  const saved = loadPromptOrder();
  let migrationRev = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      migrationRev = Number(localStorage.getItem(MIGRATION_REV_KEY) ?? '0') || 0;
    }
  } catch { /* ignore */ }
  const usingSaved = saved.length > 0;
  return {
    source: usingSaved ? 'localStorage' : 'default',
    storageKey: STORAGE_KEY,
    migrationRev,
    currentRev: CURRENT_MIGRATION_REV,
    count: usingSaved ? saved.length : DEFAULT_PROMPT_ORDER.length,
  };
}

function entryKey(p: PromptEntry): string {
  return p.slug || p.id || p.name;
}

export function sortEntriesByOrder<T extends PromptEntry>(entries: T[]): T[] {
  const order = getEffectivePromptOrder();
  if (order.length === 0) return entries.slice();
  const rank = new Map<string, number>();
  order.forEach((slug, idx) => rank.set(slug, idx));
  const tagged = entries.map((entry, idx) => ({ entry, idx, r: rank.get(entryKey(entry)) }));
  tagged.sort(compareOrderedEntries);
  return tagged.map(t => t.entry);
}

function compareOrderedEntries<T extends PromptEntry>(
  a: { entry: T; idx: number; r: number | undefined },
  b: { entry: T; idx: number; r: number | undefined },
): number {
  if (a.r === undefined && b.r === undefined) return a.idx - b.idx;
  if (a.r === undefined) return 1;
  if (b.r === undefined) return -1;
  return a.r - b.r;
}

interface DragState { draggingSlug: string | null }
const dragState: DragState = { draggingSlug: null };

export function attachDragHandlers(
  item: HTMLElement,
  p: PromptEntry,
  onReorder: () => void,
): void {
  const slug = entryKey(p);
  item.setAttribute('draggable', 'true');
  item.setAttribute('data-prompt-slug', slug);
  item.style.cursor = 'grab';
  item.addEventListener('dragstart', (event) => handleDragStart(event, slug, item));
  item.addEventListener('dragend', () => handleDragEnd(item));
  item.addEventListener('dragover', (event) => handleDragOver(event, item));
  item.addEventListener('dragleave', () => clearItemIndicator(item));
  item.addEventListener('drop', (event) => handleDrop(event, item, onReorder));
}

function handleDragStart(event: DragEvent, slug: string, item: HTMLElement): void {
  dragState.draggingSlug = slug;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', slug);
  }
  item.style.opacity = '0.5';
}

function handleDragEnd(item: HTMLElement): void {
  dragState.draggingSlug = null;
  item.style.opacity = '';
  clearDropIndicators(findDropdownRoot(item));
}

function handleDragOver(event: DragEvent, item: HTMLElement): void {
  if (!dragState.draggingSlug) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  clearDropIndicators(findDropdownRoot(item));
  const insertBefore = shouldInsertBefore(event, item);
  if (insertBefore) item.style.borderTop = '2px solid #7c3aed';
  else item.style.borderBottom = '2px solid #7c3aed';
}

function shouldInsertBefore(event: DragEvent, item: HTMLElement): boolean {
  const rect = item.getBoundingClientRect();
  return (event.clientY - rect.top) < rect.height / 2;
}

function clearItemIndicator(item: HTMLElement): void {
  item.style.borderTop = '';
  item.style.borderBottom = '';
}

function clearDropIndicators(root: HTMLElement | null): void {
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-prompt-slug]').forEach(node => {
    node.style.borderTop = '';
    node.style.borderBottom = '';
  });
}

function findDropdownRoot(item: HTMLElement): HTMLElement | null {
  return item.closest<HTMLElement>('[data-prompts-dropdown]') ?? item.parentElement;
}

function handleDrop(event: DragEvent, target: HTMLElement, onReorder: () => void): void {
  event.preventDefault();
  const root = findDropdownRoot(target);
  clearDropIndicators(root);
  const sourceSlug = dragState.draggingSlug;
  dragState.draggingSlug = null;
  if (!sourceSlug || !root) return;
  const source = root.querySelector<HTMLElement>('[data-prompt-slug="' + cssEscape(sourceSlug) + '"]');
  if (!source || source === target) return;
  const insertBefore = shouldInsertBefore(event, target);
  const targetParent = target.parentElement;
  if (!targetParent) return;
  if (insertBefore) targetParent.insertBefore(source, target);
  else targetParent.insertBefore(source, target.nextSibling);
  markDragTouched(sourceSlug);
  persistDomOrder(root);
  onReorder();
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function markDragTouched(slug: string): void {
  const set = loadDragTouched();
  set.add(slug);
  saveDragTouched(set);
}

function persistDomOrder(root: HTMLElement): void {
  const existing = loadPromptOrder();
  const domSlugs: string[] = [];
  const seenInDom = new Set<string>();
  root.querySelectorAll<HTMLElement>('[data-prompt-slug]').forEach(node => {
    const slug = node.getAttribute('data-prompt-slug');
    if (!slug || seenInDom.has(slug)) return;
    seenInDom.add(slug);
    domSlugs.push(slug);
  });
  const merged = mergeOrder(existing, domSlugs, seenInDom);
  savePromptOrder(merged);
}

function mergeOrder(existing: string[], domSlugs: string[], seenInDom: Set<string>): string[] {
  const tail = existing.filter(slug => !seenInDom.has(slug));
  return [...domSlugs, ...tail];
}

