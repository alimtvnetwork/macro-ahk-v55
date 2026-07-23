/**
 * Prompt Dropdown — Dropdown rendering with categories, Task Next, prompt items
 *
 * Phase 5D split from ui/prompt-manager.ts.
 * See: spec/04-macro-controller/ts-migration-v2/05-module-splitting.md
 */

import { log } from '../logger';
import { logDiagnosticFromCode, toDiagnosticId, toErrorMessage } from '../error-utils';
import type { PromptEntry as LoaderPromptEntry, ResolvedPromptsConfig, ExtensionResponse } from '../types';

import { cPanelFg, cPanelFgDim, cPrimary, cPrimaryLight, cBtnMenuHover, lDropdownRadius } from '../shared-state';
import { getByXPath } from '../xpath-utils';
import { pasteIntoEditor, showPasteToast } from './prompt-utils';
import { runTaskNextLoop, runTaskNextQueue, type TaskNextDeps, findNextTasksPrompt, substituteTaskNextPromptText } from './task-next-ui';
import { openTaskNextSettingsModal } from './task-next-settings-modal';
import { addTaskToQueue } from '../task-queue';
import { getDisplayProjectName } from '../logger';
import { REPLACE_KEY_DEFAULT } from '../db/prompt-defaults';
import { substituteToken } from '../utils/token-substitute';

import type { PromptContext } from './prompt-loader';
import type { EditablePrompt } from './prompt-loader';
import {
  getPromptsConfig,
  sendToExtension,
  loadPromptsFromJson,
  setRevalidateContext,
  setRenderDropdownFn,
  getPromptCategoryFilter,
  getPromptCategoryFilterSet,
  clearLoadedPrompts,
  
  saveHtmlCopy,
  getSuggestedPrompts,
} from './prompt-loader';
import { openPromptCreationModal } from './prompt-injection';
import {
  computePromptHash,
  writeUISnapshot,
  readUISnapshot,
  clearUISnapshot,
} from './prompt-cache';
import type { CachedPromptEntry } from './prompt-cache';

import { renderPlanTaskSubmenu } from './plan-task-ui';
import { renderFilterMenu } from './prompt-filter-menu';
import { buildDropdownHeader } from './prompt-dropdown-header';

import { sortEntriesByOrder, attachDragHandlers, getSlugPositionSource } from './prompt-drag-order';

/**
 * Visual metadata for each prompt-position source. Rendered as a small
 * pill next to the numeric index so users can see whether a row's position
 * came from the canonical default, a migrated saved order, or their own
 * drag-and-drop persistence.
 */
const POSITION_SOURCE_META: Record<'default' | 'migrated' | 'drag', { glyph: string; bg: string; tooltip: string }> = {
  default: { glyph: 'D',  bg: 'rgba(107,114,128,0.75)', tooltip: 'Position from DEFAULT_PROMPT_ORDER (no saved order applies).' },
  migrated: { glyph: 'M', bg: 'rgba(59,130,246,0.85)',  tooltip: 'Position from a saved order carried across migrations (not manually dragged).' },
  drag: { glyph: '⇅',      bg: 'rgba(16,185,129,0.85)',  tooltip: 'Position set by your drag-and-drop and persisted to localStorage.' },
};


/** Adapter: getByXPath returns Node|null, pasteIntoEditor needs Element|null */
function getByXPathAsElement(xpath: string): Element | null {
  const node = getByXPath(xpath);
  return node instanceof Element ? node : null;
}

// Register ourselves as the render function for background revalidation
setRenderDropdownFn(renderPromptsDropdown);

// CQ16: Keep the inline Task Next panel visible inside the prompts dropdown.
// Handles both bottom overflow (open-down) and top overflow (open-up flip from Step 3).
function keepTaskNextSubInView(promptsDropdown: HTMLElement, taskNextSub: HTMLElement): void {
  window.requestAnimationFrame(function () {
    const dropRect = promptsDropdown.getBoundingClientRect();
    const subRect = taskNextSub.getBoundingClientRect();
    const PAD = 6;
    if (subRect.bottom > dropRect.bottom) {
      promptsDropdown.scrollTop += Math.ceil(subRect.bottom - dropRect.bottom + PAD);
      return;
    }
    if (subRect.top < dropRect.top) {
      promptsDropdown.scrollTop -= Math.ceil(dropRect.top - subRect.top + PAD);
    }
  });
}

/**
 * Issue 127 Bug B — Anchor the Task Next sub-menu RIGHT of its row by default,
 * fall back to a stacked-below layout when right-side viewport space is
 * insufficient. Never let the menu clip off-screen on the left or right.
 *
 *   Default (right):  sub.position=fixed; left = rowRect.right + GAP; top = rowRect.top
 *   Fallback (below): sub.position=static; menu stacks under the row
 *
 * Sets `data-task-next-anchor` to `right` or `below` for tests / debuggers.
 */
function anchorTaskNextSub(row: HTMLElement, sub: HTMLElement, host: HTMLElement): void {
  const GAP = 6;
  const PAD = 8;
  const MIN_SUB_WIDTH = 180;

  // Measure natural width by briefly forcing the menu visible off-screen.
  const prevVisibility = sub.style.visibility;
  sub.style.visibility = 'hidden';
  sub.style.position = 'fixed';
  sub.style.left = '-9999px';
  sub.style.top = '0px';
  sub.style.display = 'block';
  const measuredWidth = Math.max(sub.getBoundingClientRect().width || 0, MIN_SUB_WIDTH);
  sub.style.visibility = prevVisibility;

  const rowRect = row.getBoundingClientRect();
  const rightSpace = window.innerWidth - rowRect.right - PAD;
  const fitsRight = rightSpace >= measuredWidth;

  if (fitsRight) {
    sub.style.position = 'fixed';
    sub.style.left = (rowRect.right + GAP) + 'px';
    sub.style.top = rowRect.top + 'px';
    sub.style.margin = '0';
    sub.setAttribute('data-task-next-anchor', 'right');
    return;
  }

  // Fallback: stack below the row inside the dropdown column.
  sub.style.position = 'static';
  sub.style.left = '';
  sub.style.top = '';
  sub.style.margin = '0 6px 6px 6px';
  sub.setAttribute('data-task-next-anchor', 'below');
  // Keep the stacked menu visible inside the scrollable prompts dropdown.
  keepTaskNextSubInView(host, sub);
}



// Legacy single-pick chip helper removed in favor of the new Filter menu.
// (Multi-select state lives in prompt-loader.ts via getPromptCategoryFilterSet.)

/**
 * In-memory mirror of the last persisted UI snapshot. Lets the prompts
 * dropdown paint synchronously on click (zero IDB round-trip, zero flicker)
 * — fixes Issue 129 S-1 where Plan Task / Task Next briefly disappeared
 * because the previous render path gated on `readUISnapshot()`.
 *
 * The IDB copy is still written by `_persistSnapshot` and still read once on
 * first paint via `_hydrateMemSnapshotOnce` to survive page reloads.
 */
interface MemSnapshot {
  html: string;
  dataHash: string;
  categoryFilter: string | null;
  promptCount: number;
  scrollTop: number;
}
let _memSnapshot: MemSnapshot | null = null;
let _memHydrated = false;
let _currentSearchQuery = '';

function _hydrateMemSnapshotOnce(): void {
  if (_memHydrated) return;
  _memHydrated = true;
  readUISnapshot().then(function(snapshot) {
    if (snapshot && !_memSnapshot) {
      _memSnapshot = {
        html: snapshot.html,
        dataHash: snapshot.dataHash,
        categoryFilter: snapshot.categoryFilter,
        promptCount: snapshot.promptCount,
        scrollTop: snapshot.scrollTop,
      };
    }
  }).catch(function() { /* swallow — IDB hydration is best-effort */ });
}

/**
 * Render the prompts dropdown with categories, Task Next submenu, and prompt items.
 *
 * SYNCHRONOUS PAINT GUARANTEE (Issue 129 Step 2): If the in-memory snapshot
 * matches the current data hash + filter, the dropdown is painted in the
 * same tick from cached HTML. No `await`, no IndexedDB on the critical
 * path. Loading state is only possible on the very first cold-cache load
 * before `_hydrateMemSnapshotOnce` resolves.
 */
export function renderPromptsDropdown(ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  setRevalidateContext(ctx, taskNextDeps);
  _hydrateMemSnapshotOnce();

  const promptsDropdown = ctx.promptsDropdown;
  const promptsCfg = getPromptsConfig() as ResolvedPromptsConfig;
  const entries = promptsCfg.entries;
  const currentHash = computePromptHash(entries as CachedPromptEntry[]);
  const currentFilter = _computeFilterKey();

  // Fast path — paint synchronously from the in-memory snapshot.
  if (
    !_currentSearchQuery
    && _memSnapshot
    && _memSnapshot.dataHash === currentHash
    && _memSnapshot.categoryFilter === currentFilter
    && _memSnapshot.promptCount === entries.length
  ) {
    log('[PromptDropdown] Sync paint from in-memory snapshot (' + _memSnapshot.promptCount + ' prompts)', 'info');
    // Intentional innerHTML: `_memSnapshot.html` is a snapshot WE captured
    // from the same container via `_persistSnapshot`. No external data path.
    // Full replacement is scheduled in a later architectural step.
    promptsDropdown.innerHTML = _memSnapshot.html;
    promptsDropdown.scrollTop = _memSnapshot.scrollTop;
    _rebindDropdownListeners(promptsDropdown, entries, promptsCfg, ctx, taskNextDeps);
    return;
  }

  // No usable snapshot — render fresh synchronously (no IDB gate).
  _renderFresh(promptsDropdown, entries, promptsCfg, ctx, taskNextDeps, currentHash, currentFilter);
}
// ============================================
// Dropdown header with Load button
// ============================================

/**
 * Slug fragments hidden from the prompts dropdown.
 * v4.12.0 (Issue 64): The legacy "cut*" prompts are deprecated; hide from
 * the picker without deleting on disk. Flip this list to re-enable.
 * v4.388.0: legacy Read Memory duplicates are hidden by slug/name so only
 * the canonical `read-memory-enhanced` row can surface in the dropdown.
 */
const HIDDEN_SLUG_FRAGMENTS: string[] = [
  'cut',
  'start-prompt',
  'start prompt',
  'default-read-memory',
  'read-memory-imported',
  'read-memory-old',
  'read-memory-v1',
  'read-memory-v2',
  'read memory (imported)',
  'read memory old',
  'read memory v1',
  'read memory v2',
  'rejog',
  'next-steps',
  'next-tasks',
  'next-task',
  'next ${n}',
  'next {{n}}',
  'next-n-steps',
  'plan-steps',
  'plan-task',
  'plan ${n}',
  'plan {{n}}',
  'plan-n-steps',
  '{{n}} steps',
];

const HIDDEN_EXACT_SLUGS: string[] = [
  'read-memory',
];

/** True when the prompt's slug, parentSlug, id, or name matches any hidden token. */
export function isHiddenBySlug(entry: { slug?: string; parentSlug?: string; id?: string; name?: string }): boolean {
  const slug = (entry.slug || '').toLowerCase();
  const parentSlug = (entry.parentSlug || '').toLowerCase();
  const id = (entry.id || '').toLowerCase();
  const name = (entry.name || '').toLowerCase();
  if (HIDDEN_EXACT_SLUGS.includes(slug) || HIDDEN_EXACT_SLUGS.includes(parentSlug)) return true;
  for (const frag of HIDDEN_SLUG_FRAGMENTS) {
    if (slug.includes(frag) || parentSlug.includes(frag) || id.includes(frag) || name.includes(frag)) return true;
  }
  return false;
}


/** Build the search input for filtering prompts. */
function buildSearchInput(ctx: PromptContext, taskNextDeps: TaskNextDeps): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'padding:6px 8px;border-bottom:1px solid rgba(124,58,237,0.2);background:rgba(124,58,237,0.05);';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '🔍 Search prompts or #tags...';
  input.value = _currentSearchQuery;
  input.style.cssText = 'width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(124,58,237,0.3);border-radius:4px;color:#fff;font-size:12px;padding:4px 8px;outline:none;';
  
  input.oninput = function() {
    _currentSearchQuery = input.value.trim().toLowerCase();
    // We re-render the filtered items part without rebuilding the whole dropdown
    // or just re-render the whole dropdown fresh
    renderPromptsDropdown(ctx, taskNextDeps);
  };
  
  // Focus on render if it was already focused? 
  // Actually, re-rendering the whole dropdown will lose focus.
  // Let's try to preserve it.
  if (_currentSearchQuery) {
    setTimeout(() => input.focus(), 0);
  }

  container.appendChild(input);
  return container;
}

function _renderFresh(
  promptsDropdown: HTMLElement,
  entries: LoaderPromptEntry[],
  promptsCfg: ReturnType<typeof getPromptsConfig>,
  ctx: PromptContext,
  taskNextDeps: TaskNextDeps,
  dataHash: string,
  categoryFilter: string | null,
): void {
  promptsDropdown.textContent = '';

  _appendHeaderAndSubmenu(promptsDropdown, entries, ctx, taskNextDeps);
  
  // Append Search Bar
  promptsDropdown.appendChild(buildSearchInput(ctx, taskNextDeps));

  if (!entries.length) {
    renderEmptyState(promptsDropdown, ctx, taskNextDeps);
    return;
  }

  _appendFilteredItems(promptsDropdown, entries, promptsCfg, ctx, taskNextDeps);
  promptsDropdown.appendChild(buildAddPromptButton(promptsDropdown, ctx, taskNextDeps));
  _persistSnapshot(promptsDropdown, entries, dataHash, categoryFilter);
}

/** Append header, Task Next + Plan Task (collapsed by default) + Filter inline menus. */
function _appendHeaderAndSubmenu(
  container: HTMLElement,
  entries: LoaderPromptEntry[],
  ctx: PromptContext,
  taskNextDeps: TaskNextDeps,
): void {
  // Mark dropdown so the Tasks toggle can find the group from any descendant click.
  if (!container.hasAttribute('data-prompts-dropdown')) container.setAttribute('data-prompts-dropdown', '1');
  // Ensure the container can host an absolutely-positioned right-anchored Tasks panel.
  if (!container.style.position) container.style.position = 'relative';
  container.appendChild(buildDropdownHeader(ctx, taskNextDeps, () => renderPromptsDropdown(ctx, taskNextDeps)));

  // v4.x: Plan Task submenu removed from this dropdown — it lives elsewhere
  // in the extension UI. The 'plan' tab / floating group are no longer built.

  const categories = collectUniqueCategories(entries);
  renderFilterMenu(container, categories, ctx, taskNextDeps, renderPromptsDropdown);
}

// _buildFloatingGroup removed (v4.27+): Plan/Next tabbed floating groups are no longer used.



/** Append filtered prompt items or empty-category message. */
function _appendFilteredItems(
  container: HTMLElement,
  entries: LoaderPromptEntry[],
  promptsCfg: ReturnType<typeof getPromptsConfig>,
  ctx: PromptContext,
  taskNextDeps: TaskNextDeps,
): void {
  // v4.12.0 (Issue 64): drop deprecated "cut*" slug prompts up front so
  // suggestions / favorites / folder lists all skip them in one place.
  entries = entries.filter(e => !isHiddenBySlug(e));
  entries = sortEntriesByOrder(entries);
  // 0. Render Suggestions (if no search and not in a specific category)
  if (!getPromptCategoryFilter() && !_currentSearchQuery) {
    const suggestions = getSuggestedPrompts(entries);
    if (suggestions.length > 0) {
      const sugHeader = document.createElement('div');
      sugHeader.style.cssText = 'padding:6px 10px;font-size:11px;font-weight:700;color:#3daee9;background:rgba(61,174,233,0.05);text-transform:uppercase;letter-spacing:0.5px;';
      sugHeader.textContent = '✨ Suggested';
      container.appendChild(sugHeader);
      suggestions.forEach((p: LoaderPromptEntry, idx: number) => {
        container.appendChild(renderPromptItem(idx, p, container, promptsCfg, ctx, taskNextDeps));
      });
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:rgba(124,58,237,0.2);margin:4px 0;';
      container.appendChild(sep);
    }
  }

  // 1. Render Favorites (pinned to top)

  const favorites = entries.filter(p => p.isFavorite);
  if (favorites.length > 0 && !getPromptCategoryFilter() && !_currentSearchQuery) {
    const favHeader = document.createElement('div');
    favHeader.style.cssText = 'padding:6px 10px;font-size:11px;font-weight:700;color:#facc15;background:rgba(250,204,21,0.05);text-transform:uppercase;letter-spacing:0.5px;';
    favHeader.textContent = '⭐ Favorites';
    container.appendChild(favHeader);
    for (const [idx, p] of favorites.entries()) {
      container.appendChild(renderPromptItem(idx, p, container, promptsCfg, ctx, taskNextDeps));
    }
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(124,58,237,0.2);margin:4px 0;';
    container.appendChild(sep);
  }

  // 2. Render normal filtered items with folder support
  const filtered = filterByCategory(entries);
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:12px 8px;text-align:center;color:' + cPanelFgDim + ';font-size:13px;';
    empty.textContent = 'No prompts found';
    container.appendChild(empty);
    return;
  }

  // v5.2.0: Always render flat so DEFAULT_PROMPT_ORDER (or the user's
  // drag-persisted order) is honored end-to-end. Folder grouping was
  // silently shuffling items and defeating drag-and-drop reordering.
  for (const [idx, p] of filtered.entries()) {
    container.appendChild(renderPromptItem(idx, p, container, promptsCfg, ctx, taskNextDeps));
  }

}


/** Save UI snapshot + HtmlCopy for fast restore. */
function _persistSnapshot(container: HTMLElement, entries: LoaderPromptEntry[], dataHash: string, categoryFilter: string | null): void {
  const snapshotHtml = container.innerHTML;

  // Update the in-memory mirror immediately so subsequent renders paint sync
  // (Issue 129 Step 2). IDB writes below remain best-effort and async.
  _memSnapshot = {
    html: snapshotHtml,
    dataHash: dataHash,
    categoryFilter: categoryFilter,
    promptCount: entries.length,
    scrollTop: container.scrollTop,
  };
  _memHydrated = true;

  writeUISnapshot({
    html: snapshotHtml,
    categoryFilter: categoryFilter,
    scrollTop: container.scrollTop,
    promptCount: entries.length,
    dataHash: dataHash,
  }).then(function() {
    log('[PromptDropdown] UI snapshot saved', 'info');
  });

  saveHtmlCopy({
    html: snapshotHtml,
    promptCount: entries.length,
    dataHash: dataHash,
  }).then(function() {
    log('[PromptDropdown] HtmlCopy saved to IndexedDB', 'info');
  });
}

/**
 * Re-bind click/hover/input event listeners on snapshot-restored HTML.
 * Uses data attributes and DOM structure matching to reconnect handlers.
 */
function _rebindDropdownListeners(
  promptsDropdown: HTMLElement,
  entries: LoaderPromptEntry[],
  promptsCfg: ReturnType<typeof getPromptsConfig>,
  ctx: PromptContext,
  taskNextDeps: TaskNextDeps,
): void {
  _cleanupTaskNextSubs();
  _rebindHeader(promptsDropdown, ctx, taskNextDeps);
  _rebindTaskNextSubmenu(promptsDropdown, ctx, taskNextDeps);
  _rebindPlanTaskSubmenus(promptsDropdown, ctx);
  _rebindFilterMenu(promptsDropdown, entries, ctx, taskNextDeps);
  _rebindPromptItems(promptsDropdown, entries, promptsCfg, ctx, taskNextDeps);
  _rebindAddButton(promptsDropdown, ctx, taskNextDeps);
}

/**
 * Rebuild every Plan Task submenu in the dropdown after a snapshot restore.
 *
 * Issue 129 Step 3 root cause: snapshot restore writes `innerHTML`, which
 * destroys the per-element `onclick` handlers attached by
 * `renderPlanTaskSubmenu()` in plan-task-ui.ts. The previous rebind list
 * only touched the Task Next submenu, so the Plan Task row (inline + inside
 * the 🎯 Tasks floating panel) silently became dead HTML — clicking the
 * "🧠 Plan Task" header toggled nothing, and the preset "Plan in N steps"
 * rows did not inject the prompt.
 *
 * Fix: locate the inline row (`[data-inline-plan-row]`) and the in-Tasks-group
 * copy (the `[data-plan-task-sub]` element's grandparent), clear them, and
 * re-render via `renderPlanTaskSubmenu` so all listeners are fresh.
 */
function _rebindPlanTaskSubmenus(container: HTMLElement, ctx: PromptContext): void {
  // v4.12.0: Plan now lives in a single floating popover keyed by
  // [data-plan-group]. Rebuild its contents in-place so listeners are fresh.
  const planGroup = container.querySelector('[data-plan-group]') as HTMLElement | null;
  if (planGroup) {
    planGroup.textContent = '';
    renderPlanTaskSubmenu(planGroup, ctx);
  }
}

/** Re-attach the Load button handler in the dropdown header. */
function _rebindHeader(container: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  const header = container.firstElementChild as HTMLElement;
  if (!header) return;
  const oldLoadBtn = header.querySelector('span[title="Reload prompts from database"]') as HTMLElement | null;
  if (oldLoadBtn) {
    // Rebuild the whole header (5 pills) rather than reach into the extracted
    // header module for a single builder, keeps the graph acyclic.
    const rebuilt = buildDropdownHeader(ctx, taskNextDeps, () => renderPromptsDropdown(ctx, taskNextDeps));
    header.replaceWith(rebuilt);
  }
}


/** Rebuild the Next floating popover after snapshot restore. */
function _rebindTaskNextSubmenu(container: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  const nextGroup = container.querySelector('[data-next-group]') as HTMLElement | null;
  if (nextGroup) {
    nextGroup.textContent = '';
    renderTaskNextSubmenu(nextGroup, ctx, taskNextDeps);
  }
}

/** Remove stale Task Next sub-menus from DOM. */
function _cleanupTaskNextSubs(): void {
  const subs = document.querySelectorAll('[data-task-next-sub]');
  subs.forEach(function(el) { el.remove(); });
}

/** Rebuild the inline Filter menu in the dropdown after snapshot restore. */
function _rebindFilterMenu(
  container: HTMLElement,
  entries: LoaderPromptEntry[],
  ctx: PromptContext,
  taskNextDeps: TaskNextDeps,
): void {
  // Locate the element with [data-prompt-filter-sub], walk to its item-container and replace it.
  const filterSub = container.querySelector('[data-prompt-filter-sub]');
  if (filterSub) {
    const filterItem = filterSub.parentElement;
    if (filterItem && filterItem.parentElement === container) {
      const categories = collectUniqueCategories(entries);
      filterItem.textContent = '';
      const idx = Array.from(container.children).indexOf(filterItem);
      filterItem.remove();
      renderFilterMenu(container, categories, ctx, taskNextDeps, renderPromptsDropdown);
      // Try to maintain order if possible, though append is usually fine
      const newItem = container.lastElementChild;
      if (newItem && container.children[idx]) {
        container.insertBefore(newItem, container.children[idx]);
      }
    }
  }

}


/** Re-attach prompt item click/hover handlers from snapshot. */
function _rebindPromptItems(
  container: HTMLElement,
  entries: LoaderPromptEntry[],
  promptsCfg: ReturnType<typeof getPromptsConfig>,
  ctx: PromptContext,
  taskNextDeps: TaskNextDeps,
): void {
  // Bug fix: after drag-reorder (or any DOM-order divergence from the
  // filtered array), pairing items[i] to filtered[i] by position rebinds
  // click / ⋯ / edit / delete handlers to the WRONG prompt. Look each DOM
  // item up by its stable identity (slug, then id, then original render
  // index) so the ⋯ actions always target the prompt that visually sits in
  // that row.
  const filtered = filterByCategory(entries);
  const items = _findPromptItemElements(container);
  const bySlug = new Map<string, LoaderPromptEntry>();
  const byId = new Map<string, LoaderPromptEntry>();
  filtered.forEach(entry => {
    if (entry.slug) bySlug.set(entry.slug, entry);
    if (entry.id) byId.set(String(entry.id), entry);
  });

  for (let i = 0; i < items.length; i++) {
    const dom = items[i];
    const slug = dom.getAttribute('data-prompt-slug') || '';
    const id = dom.getAttribute('data-prompt-id') || '';
    const idxAttr = dom.getAttribute('data-prompt-idx');
    const resolved =
      (slug && bySlug.get(slug))
      || (id && byId.get(id))
      || (idxAttr !== null ? filtered[parseInt(idxAttr, 10)] : undefined)
      || filtered[i];
    if (!resolved) continue;
    _bindSinglePromptItem(dom, resolved, container, promptsCfg, ctx, taskNextDeps);
  }
}

/** Find DOM elements tagged as prompt items via data attribute. */
function _findPromptItemElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-prompt-idx]')) as HTMLElement[];
}

/** Bind hover/click on a single restored prompt item. */
function _bindSinglePromptItem(
  item: HTMLElement, p: PromptEntry, container: HTMLElement,
  promptsCfg: ReturnType<typeof getPromptsConfig>, ctx: PromptContext, taskNextDeps: TaskNextDeps,
): void {
  item.onmouseover = function() { (this as HTMLElement).style.background = cBtnMenuHover; };
  item.onmouseout = function() { (this as HTMLElement).style.background = 'transparent'; };
  if (!p.text) return;

  const actionsSpan = (item.querySelector('[data-prompt-actions]') as HTMLElement)
    || (item.querySelector('span:last-child') as HTMLElement);
  item.onclick = function(e: Event) {
    if (actionsSpan && actionsSpan.contains(e.target as Node)) return;
    pasteIntoEditor(p.text, promptsCfg, getByXPathAsElement);
    container.style.display = 'none';
  };
  if (actionsSpan) {
    _rebindActionIcons(actionsSpan, p, container, ctx, taskNextDeps);
  }
}

/** Re-attach the Add New Prompt button handler. */
function _rebindAddButton(container: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  const lastChild = container.lastElementChild as HTMLElement;
  if (!lastChild || !lastChild.textContent?.includes('Add New Prompt')) return;
  lastChild.onmouseover = function() { (this as HTMLElement).style.background = 'rgba(139,92,246,0.2)'; };
  lastChild.onmouseout = function() { (this as HTMLElement).style.background = 'transparent'; };
  lastChild.onclick = function(e: Event) {
    e.stopPropagation();
    container.style.display = 'none';
    openPromptCreationModal(ctx, taskNextDeps, null);
  };
}

function _rebindActionIcons(
  actionsSpan: HTMLElement,
  p: PromptEntry,
  promptsDropdown: HTMLElement,
  ctx: PromptContext,
  taskNextDeps: TaskNextDeps,
): void {
  const icons = actionsSpan.querySelectorAll('span');
  for (const icon of icons) {
    const el = icon as HTMLElement;
    el.onmouseover = function() { (this as HTMLElement).style.opacity = '1'; };
    el.onmouseout = function() { (this as HTMLElement).style.opacity = el.style.opacity; };
    if (el.title === 'Edit prompt') {
      el.onclick = function(e: Event) {
        e.stopPropagation();
        promptsDropdown.style.display = 'none';
        openPromptCreationModal(ctx, taskNextDeps, _buildEditablePromptFromEntry(p));
      };
    } else if (el.title === 'Delete prompt') {
      el.onclick = function(e: Event) {
        e.stopPropagation();
        if (!confirm('Delete prompt "' + p.name + '"?')) return;
        sendToExtension('DELETE_PROMPT', { promptId: p.id }).then(function(resp: Record<string, unknown>) {
          if (resp && resp.isOk) {
            clearLoadedPrompts();
            clearUISnapshot();
            loadPromptsFromJson().then(function() { renderPromptsDropdown(ctx, taskNextDeps); });
          }
        });
      };
    } else if (el.title === 'Copy to clipboard') {
      el.onclick = function(e: Event) {
        e.stopPropagation();
        navigator.clipboard.writeText(p.text).then(function() {
          el.textContent = '✅';
          setTimeout(function() { el.textContent = '📋'; }, 1500);
        });
      };
    }
  }
}

function renderEmptyState(container: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  const emptyState = document.createElement('div');
  emptyState.style.cssText = 'padding:20px 12px;text-align:center;color:' + cPanelFgDim + ';font-size:13px;';
  // Plan-17 step 14: static markup replaced with DOM API to purge innerHTML pattern.
  const icon = document.createElement('div');
  icon.style.cssText = 'font-size:28px;margin-bottom:8px;';
  icon.textContent = '📋';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:600;margin-bottom:4px;';
  title.textContent = 'No prompts available';
  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;opacity:0.7;';
  hint.textContent = 'Click ➕ below to create your first prompt';
  emptyState.append(icon, title, hint);
  container.appendChild(emptyState);
  container.appendChild(buildAddPromptButton(container, ctx, taskNextDeps));
}

/**
 * Normalize a raw category label into a canonical bucket.
 * Consolidates variants like "App Spec Audit", "True Feed", "Spec Audit"
 * into a single "audit" bucket per user request (fewer categories overall).
 */
function normalizeCategory(raw: string | undefined): string {
  const cat = (raw || '').trim().toLowerCase();
  if (!cat) return '';
  if (cat.includes('audit') || cat.includes('spec') || cat.includes('proofread') || cat.includes('true feed') || cat.includes('true-feed')) {
    return 'audit';
  }
  if (cat.includes('bump') || cat.includes('release')) return 'release';
  return cat;
}

function collectUniqueCategories(entries: Array<{ category?: string }>): string[] {
  const categories: string[] = [];
  const catSeen: Record<string, boolean> = {};
  for (const entry of entries) {
    const cat = normalizeCategory(entry.category);
    if (cat && !catSeen[cat]) {
      categories.push(cat);
      catSeen[cat] = true;
    }
  }
  return categories;
}

/** Combined filter key for snapshot validation — covers legacy single + new multi set. */
function _computeFilterKey(): string {
  const legacy = getPromptCategoryFilter() || '';
  const multi = Array.from(getPromptCategoryFilterSet()).sort().join(',');
  return legacy + '|' + multi + '|' + _currentSearchQuery;
}

function filterByCategory<T extends { name: string; text: string; slug?: string; category?: string; tags?: string[] }>(entries: T[]): T[] {
  // v4.12.0 (Issue 64): drop deprecated "cut*" slug prompts up front.
  let filtered = entries.filter(e => !isHiddenBySlug(e));
  const set = getPromptCategoryFilterSet();

  if (set.size > 0) {
    filtered = filtered.filter(entry => set.has(normalizeCategory(entry.category)));
  } else {
    const legacy = getPromptCategoryFilter();
    if (legacy) {
      filtered = filtered.filter(entry => normalizeCategory(entry.category) === legacy);
    }
  }


  if (_currentSearchQuery) {
    const q = _currentSearchQuery.toLowerCase();
    filtered = filtered.filter(entry => {
      const name = (entry.name || '').toLowerCase();
      const text = (entry.text || '').toLowerCase();
      const tags = (entry.tags || []).join(' ').toLowerCase();
      return name.includes(q) || text.includes(q) || tags.includes(q);
    });
  }

  return filtered;
}

function renderTaskNextSubmenu(container: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  const promptsDropdown = ctx.promptsDropdown;
  const { taskNextItem, taskNextSub } = _buildTaskNextMenuShell(promptsDropdown, taskNextDeps);

  _appendPresetCounts(taskNextSub, promptsDropdown, taskNextDeps);
  _appendCustomCountRow(taskNextSub, promptsDropdown, taskNextDeps);
  _appendTaskNextSettings(taskNextSub, promptsDropdown, taskNextDeps);
  container.appendChild(taskNextItem);
}

function _buildTaskNextMenuShell(promptsDropdown: HTMLElement, taskNextDeps: TaskNextDeps): { taskNextItem: HTMLElement; taskNextSub: HTMLElement } {
  const taskNextItem = document.createElement('div');
  taskNextItem.style.cssText = 'border-bottom:1px solid rgba(124,58,237,0.3);';
  const taskNextRow = document.createElement('div');
  taskNextRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:5px 8px;cursor:pointer;font-size:13px;color:#e9d5ff;font-weight:700;background:rgba(124,58,237,0.18);';
  const taskNextLabel = document.createElement('span');
  taskNextLabel.textContent = '⏭ Task Next';
  taskNextRow.appendChild(taskNextLabel);
  const taskNextArrow = document.createElement('span');
  taskNextArrow.textContent = '▸';
  taskNextArrow.style.cssText = 'font-size:13px;margin-left:4px;color:#e9d5ff;';
  taskNextRow.appendChild(taskNextArrow);

  const taskNextSub = document.createElement('div');
  taskNextSub.setAttribute('data-task-next-sub', '1');
  taskNextSub.setAttribute('data-task-next-anchor', 'right');
  // Issue 127 Bug B: sub-menu opens RIGHTWARD of the Task Next row by default
  // (position:fixed + computed left/top against row's getBoundingClientRect).
  // When right-side viewport space is insufficient, anchorTaskNextSub() flips
  // back to a static stacked-below layout so the menu never clips off-screen.
  taskNextSub.style.cssText = 'display:none;position:fixed;min-width:180px;max-width:240px;background:rgba(20,16,32,0.96);border:1px solid ' + cPrimary + ';border-radius:' + lDropdownRadius + ';box-shadow:0 8px 24px rgba(0,0,0,0.45);z-index:10002;';
  taskNextItem.appendChild(taskNextRow);
  taskNextItem.appendChild(taskNextSub);

  const showSub = function(): void {
    taskNextRow.style.background = cBtnMenuHover;
    taskNextArrow.textContent = '▾';
    taskNextSub.style.display = 'block';
    anchorTaskNextSub(taskNextRow, taskNextSub, promptsDropdown);
  };
  const hideSub = function(): void {
    taskNextRow.style.background = 'transparent';
    taskNextArrow.textContent = '▸';
    taskNextSub.style.display = 'none';
  };
  taskNextRow.onmouseover = showSub;
  // Split-button pattern: clicking the label area pastes the Next Tasks prompt
  // once (count=1) and closes the dropdown — matches user expectation that
  // clicking "Task Next" immediately pastes the next prompt. Clicking the ▸/▾
  // arrow toggles the submenu for choosing a custom count.
  taskNextLabel.style.cursor = 'pointer';
  taskNextLabel.title = 'Click to paste the Next Tasks prompt (use ▸ for count options)';
  taskNextLabel.onclick = function(e: Event) {
    e.stopPropagation();
    promptsDropdown.style.display = 'none';
    hideSub();
    runTaskNextLoop(taskNextDeps, 1);
  };
  taskNextArrow.style.cursor = 'pointer';
  taskNextArrow.onclick = function(e: Event) {
    e.stopPropagation();
    if (taskNextSub.style.display === 'none') showSub(); else hideSub();
  };
  taskNextItem.onmouseout = function() {
    setTimeout(function() {
      if (!taskNextItem.matches(':hover')) hideSub();
    }, 100);
  };

  return { taskNextItem, taskNextSub };
}

function _appendPresetCounts(taskNextSub: HTMLElement, promptsDropdown: HTMLElement, taskNextDeps: TaskNextDeps): void {
  const presetCounts = [1, 2, 3, 5, 7, 10, 12, 15, 20, 30, 40];
  for (const count of presetCounts) {
    const subItem = document.createElement('div');
    subItem.style.cssText = 'padding:5px 12px;cursor:pointer;font-size:12px;color:' + cPanelFg + ';display:flex;justify-content:space-between;align-items:center;';
    
    const label = document.createElement('span');
    label.textContent = 'Next ' + count + ' task' + (count > 1 ? 's' : '');
    subItem.appendChild(label);

    const queueBtn = document.createElement('span');
    queueBtn.textContent = '➕';
    queueBtn.title = 'Add ' + count + ' tasks to queue';
    queueBtn.style.cssText = 'padding:2px 4px;font-size:12px;cursor:pointer;opacity:0.6;';
    queueBtn.onclick = async (e: Event) => {
      e.stopPropagation();
      const prompt = findNextTasksPrompt(taskNextDeps);
      if (!prompt) {
        showPasteToast('❌ "Next Tasks" prompt not found', true);
        return;
      }
      const projectName = getDisplayProjectName();
      for (let i = 0; i < count; i++) {
        await addTaskToQueue(substituteTaskNextPromptText(prompt, 1), projectName);
      }
      showPasteToast(`✅ Queued ${count} tasks`, false);
      const queueList = document.getElementById('task-queue-list');
      if (queueList) {
        // Force refresh Task Queue UI if visible
        queueList.dispatchEvent(new CustomEvent('refresh-queue'));
      }
    };
    subItem.appendChild(queueBtn);

    subItem.onmouseover = function() { (this as HTMLElement).style.background = cBtnMenuHover; queueBtn.style.opacity = '1'; };
    subItem.onmouseout = function() { (this as HTMLElement).style.background = 'transparent'; queueBtn.style.opacity = '0.6'; };
    
    label.onclick = function(e: Event) {
      e.stopPropagation();
      promptsDropdown.style.display = 'none';
      taskNextSub.style.display = 'none';
      if (count <= 1) runTaskNextLoop(taskNextDeps, count);
      else void runTaskNextQueue(taskNextDeps, count);
    };
    taskNextSub.appendChild(subItem);
  }
}


function _appendCustomCountRow(taskNextSub: HTMLElement, promptsDropdown: HTMLElement, taskNextDeps: TaskNextDeps): void {
  const customRow = document.createElement('div');
  customRow.style.cssText = 'display:flex;align-items:center;gap:4px;padding:5px 12px;border-top:1px solid rgba(124,58,237,0.2);';
  const customLabel = document.createElement('span');
  customLabel.textContent = 'Custom:';
  customLabel.style.cssText = 'font-size:12px;color:' + cPrimaryLight + ';';
  customRow.appendChild(customLabel);
  const customInput = document.createElement('input');
  customInput.type = 'number'; customInput.min = '1'; customInput.max = '999'; customInput.placeholder = '#';
  customInput.style.cssText = 'width:50px;padding:3px 5px;background:rgba(0,0,0,0.3);border:1px solid rgba(124,58,237,0.3);border-radius:4px;color:' + cPanelFg + ';font-size:12px;';
  customInput.onclick = function(e: Event) { e.stopPropagation(); };
  customRow.appendChild(customInput);
  const goBtn = document.createElement('span');
  goBtn.textContent = '▶'; goBtn.title = 'Go';
  goBtn.style.cssText = 'cursor:pointer;font-size:13px;color:' + cPrimary + ';';
  goBtn.onclick = function(e: Event) {
    e.stopPropagation();
    const n = parseInt(customInput.value);
    if (!n || n < 1 || n > 999) { showPasteToast('⚠️ Enter 1–999', true); return; }
    promptsDropdown.style.display = 'none';
    taskNextSub.style.display = 'none';
    if (n <= 1) runTaskNextLoop(taskNextDeps, n);
    else void runTaskNextQueue(taskNextDeps, n);
  };
  customInput.onkeydown = function(e: KeyboardEvent) { if (e.key === 'Enter') { e.stopPropagation(); goBtn.click(); } };
  customRow.appendChild(goBtn);
  taskNextSub.appendChild(customRow);
}

function _appendTaskNextSettings(taskNextSub: HTMLElement, promptsDropdown: HTMLElement, taskNextDeps: TaskNextDeps): void {
  const settingsItem = document.createElement('div');
  settingsItem.style.cssText = 'padding:5px 12px;cursor:pointer;font-size:12px;color:' + cPrimaryLight + ';border-top:1px solid rgba(124,58,237,0.2);';
  settingsItem.textContent = '⚙ Settings';
  settingsItem.onmouseover = function() { (this as HTMLElement).style.background = cBtnMenuHover; };
  settingsItem.onmouseout = function() { (this as HTMLElement).style.background = 'transparent'; };
  settingsItem.onclick = function(e: Event) {
    e.stopPropagation();
    promptsDropdown.style.display = 'none';
    taskNextSub.style.display = 'none';
    openTaskNextSettingsModal(taskNextDeps);
  };
  taskNextSub.appendChild(settingsItem);
}

interface PromptEntry {
  id?: string;
  slug?: string;
  name: string;
  text: string;
  category?: string;
  isDefault?: boolean;
  tags?: string[];
  replaceKey?: string;
  variantValue?: string;
}

function getPromptVariantValue(p: PromptEntry): number | null {
  const parsed = Number.parseInt(String(p.variantValue || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolvePromptPasteText(p: PromptEntry): string {
  const variantValue = getPromptVariantValue(p);
  if (!variantValue) return p.text;
  return substituteToken(p.text, p.replaceKey || REPLACE_KEY_DEFAULT, variantValue);
}

function makeTagEl(tag: string): HTMLElement {
  const tagEl = document.createElement('span');
  tagEl.textContent = tag;
  tagEl.style.cssText = 'font-size:10px;line-height:1.2;background:rgba(124,58,237,0.18);color:' + cPrimaryLight + ';padding:0 4px;border-radius:2px;border:1px solid rgba(124,58,237,0.2);';
  return tagEl;
}

function resolveTags(p: PromptEntry): string[] {
  const rawTags = Array.isArray(p.tags) ? p.tags.slice() : [];
  const nameLc = (p.name || '').toLowerCase();
  const isReleaseFamily = /\b(bump|release|patch bump|minor bump|major bump)\b/.test(nameLc);
  if (isReleaseFamily && !rawTags.some(t => (t || '').toLowerCase() === 'release')) {
    rawTags.unshift('release');
  }
  return rawTags;
}

function renderTagsWrap(rawTags: string[]): HTMLElement | null {
  if (rawTags.length === 0) return null;
  const tagsWrap = document.createElement('div');
  tagsWrap.style.cssText = 'display:flex;gap:3px;flex-wrap:nowrap;overflow:hidden;flex-shrink:0;';
  const MAX_INLINE_TAGS = 2;
  rawTags.slice(0, MAX_INLINE_TAGS).forEach(tag => tagsWrap.appendChild(makeTagEl(tag)));
  const overflowTags = rawTags.slice(MAX_INLINE_TAGS);
  if (overflowTags.length > 0) {
    const moreTag = document.createElement('span');
    moreTag.textContent = '+' + overflowTags.length;
    moreTag.title = 'More tags: ' + overflowTags.join(', ') + ' (click to expand)';
    moreTag.setAttribute('aria-label', 'Show ' + overflowTags.length + ' more tags');
    moreTag.style.cssText = 'font-size:10px;line-height:1.4;background:rgba(124,58,237,0.22);color:' + cPrimaryLight + ';padding:1px 6px;border-radius:8px;border:1px solid rgba(124,58,237,0.4);cursor:pointer;font-weight:600;letter-spacing:0.2px;white-space:nowrap;';
    moreTag.onclick = function(evt: Event): void {
      evt.stopPropagation();
      overflowTags.forEach(tag => tagsWrap.insertBefore(makeTagEl(tag), moreTag));
      moreTag.remove();
    };
    tagsWrap.appendChild(moreTag);
  }

  return tagsWrap;
}

function bindPromptItemClick(
  item: HTMLElement, p: PromptEntry, actions: HTMLElement, promptsDropdown: HTMLElement,
  promptsCfg: ReturnType<typeof getPromptsConfig>, ctx: PromptContext, taskNextDeps: TaskNextDeps
): void {
  item.onclick = async function(e: MouseEvent) {
    if (actions.contains(e.target as Node)) return;
    if (e.altKey) {
      e.stopPropagation();
      _openInlinePromptEditor(item, p, ctx, taskNextDeps);
      return;
    }
    log('Prompt clicked: "' + p.name + '" (' + p.text.length + ' chars)', 'info');
    const outcome = await pasteIntoEditor(resolvePromptPasteText(p), promptsCfg, getByXPathAsElement);
    if (outcome === 'injected' || outcome === 'clipboard') {
      promptsDropdown.style.display = 'none';
    }
  };
}

function renderPromptItem(
  idx: number, p: PromptEntry, promptsDropdown: HTMLElement,
  promptsCfg: ReturnType<typeof getPromptsConfig>, ctx: PromptContext, taskNextDeps: TaskNextDeps
): HTMLElement {
  const item = document.createElement('div');
  item.setAttribute('data-prompt-idx', String(idx));
  if (p.slug) item.setAttribute('data-prompt-slug', p.slug);
  if (p.id) item.setAttribute('data-prompt-id', String(p.id));
  const hasText = Boolean(p.text);
  item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;cursor:pointer;font-size:12px;line-height:1.4;color:' + (hasText ? '#c9a8ef' : '#6b5a8a') + ';border-bottom:1px solid rgba(124,58,237,0.12);' + (hasText ? '' : 'opacity:0.6;');
  item.onmouseover = function() { (this as HTMLElement).style.background = cBtnMenuHover; };
  item.onmouseout = function() { (this as HTMLElement).style.background = 'transparent'; };

  const badge = document.createElement('span');
  badge.textContent = String(idx + 1);
  badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:3px;background:' + (hasText ? cPrimary : 'rgba(124,58,237,0.3)') + ';color:' + cPanelFg + ';font-size:10px;font-weight:700;margin-right:5px;flex-shrink:0;';
  item.appendChild(badge);

  if (p.slug) {
    const src = getSlugPositionSource(p.slug);
    const meta = POSITION_SOURCE_META[src.source];
    const sourceBadge = document.createElement('span');
    sourceBadge.setAttribute('data-position-source', src.source);
    sourceBadge.textContent = meta.glyph;
    sourceBadge.title =
      meta.tooltip +
      '\nSlug: ' + p.slug +
      '\nStorage key: ' + src.storageKey +
      '\nMigration rev: ' + src.migrationRev + ' / current ' + src.currentRev;
    sourceBadge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:14px;height:14px;padding:0 4px;border-radius:7px;background:' + meta.bg + ';color:#fff;font-size:9px;font-weight:700;margin-right:5px;flex-shrink:0;cursor:help;';
    item.appendChild(sourceBadge);
  }

  const nameSpan = document.createElement('span');
  nameSpan.textContent = p.name + (hasText ? '' : ' (text not loaded)');
  nameSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25;';
  nameSpan.title = p.text || 'Prompt text not available, click Load to refresh';

  const contentWrap = document.createElement('div');
  contentWrap.style.cssText = 'flex:1;display:flex;flex-direction:row;align-items:center;gap:6px;overflow:hidden;min-width:0;';
  contentWrap.appendChild(nameSpan);
  const tagsWrap = renderTagsWrap(resolveTags(p));
  if (tagsWrap) contentWrap.appendChild(tagsWrap);
  item.appendChild(contentWrap);

  const actions = document.createElement('span');
  actions.setAttribute('data-prompt-actions', '');
  actions.style.cssText = 'display:flex;align-items:center;gap:2px;margin-left:4px;flex-shrink:0;';

  if (hasText) {
    appendPromptActions(actions, p, promptsDropdown, promptsCfg, ctx, taskNextDeps);
    bindPromptItemClick(item, p, actions, promptsDropdown, promptsCfg, ctx, taskNextDeps);
  } else {
    item.onclick = function() {
      showPasteToast('⚠️ Prompt text not loaded, click ↻ Load to refresh', true);
    };
  }
  item.appendChild(actions);
  attachDragHandlers(item, p, () => renderPromptsDropdown(ctx, taskNextDeps));
  return item;
}

/** Open an inline editor for a prompt. */
function _openInlinePromptEditor(item: HTMLElement, p: LoaderPromptEntry, ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  // Plan-17 step 15: replace innerHTML save/restore with a live-DOM clone.
  // Root cause: innerHTML serialization drops event handlers, breaks
  // custom-element upgrades, and re-parses untrusted-looking attribute values.
  // A DocumentFragment holds the real child nodes; `replaceChildren(...)`
  // moves them back on Cancel with identical listeners still attached.
  const savedChildren = document.createDocumentFragment();
  while (item.firstChild) savedChildren.appendChild(item.firstChild);
  const savedBg = item.style.background;
  const savedPad = item.style.padding;
  item.style.background = 'rgba(0,0,0,0.3)';
  item.style.padding = '8px';
  item.onclick = (e) => e.stopPropagation();

  const nameInput = document.createElement('input');
  nameInput.value = p.name;
  nameInput.placeholder = 'Prompt Name';
  nameInput.style.cssText = 'width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(124,58,237,0.3);color:#fff;font-size:10px;padding:4px;border-radius:3px;margin-bottom:4px;';
  
  const textInput = document.createElement('textarea');
  textInput.value = p.text;
  textInput.placeholder = 'Prompt Content';
  textInput.style.cssText = 'width:100%;height:80px;background:rgba(255,255,255,0.05);border:1px solid rgba(124,58,237,0.3);color:#fff;font-size:10px;padding:4px;border-radius:3px;resize:vertical;';

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:4px;margin-top:6px;';

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.style.cssText = 'padding:2px 8px;font-size:9px;background:transparent;border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:3px;cursor:pointer;';
  cancel.onclick = () => {
    item.replaceChildren(savedChildren);
    item.style.background = savedBg || 'transparent';
    item.style.padding = savedPad || '6px 8px';
    // Re-render whole dropdown to restore listeners correctly
    renderPromptsDropdown(ctx, taskNextDeps);
  };

  const save = document.createElement('button');
  save.textContent = 'Save';
  save.style.cssText = 'padding:2px 10px;font-size:9px;background:#6d28d9;border:none;color:#fff;border-radius:3px;cursor:pointer;font-weight:600;';
  save.onclick = () => {
    const updated = { ...p, name: nameInput.value.trim(), text: textInput.value.trim() };
    if (!updated.name || !updated.text) return;
    
    sendToExtension('SAVE_PROMPT', { prompt: updated }).then(function(resp: Record<string, unknown>) {
      if (resp && resp.isOk) {
        log('Prompt updated inline: ' + updated.name, 'success');
        showPasteToast('✏️ Prompt updated: ' + updated.name, false);
        clearLoadedPrompts();
        clearUISnapshot();
        loadPromptsFromJson().then(function() { renderPromptsDropdown(ctx, taskNextDeps); });
      }
    });
  };

  footer.appendChild(cancel);
  footer.appendChild(save);
  item.appendChild(nameInput);
  item.appendChild(textInput);
  item.appendChild(footer);
  
  nameInput.focus();
}


function appendPromptActions(
  actions: HTMLElement, p: PromptEntry, promptsDropdown: HTMLElement,
  _promptsCfg: ReturnType<typeof getPromptsConfig>, ctx: PromptContext, taskNextDeps: TaskNextDeps,
): void {
  actions.appendChild(_buildFavoriteIcon(p, promptsDropdown, ctx, taskNextDeps));
  actions.appendChild(_buildEditIcon(p, promptsDropdown, ctx, taskNextDeps));
  actions.appendChild(_buildCopyIcon(p));
  actions.appendChild(_buildDeleteIcon(p, promptsDropdown, ctx, taskNextDeps));
}

/** Build the favorite ⭐ toggle icon for a prompt item. */
function _buildFavoriteIcon(p: LoaderPromptEntry, _dropdown: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): HTMLElement {
  const isFav = !!(p as LoaderPromptEntry & { isFavorite?: boolean }).isFavorite;
  const icon = _makeActionIcon(isFav ? '⭐' : '☆', isFav ? 'Remove from favorites' : 'Mark as favorite', isFav ? '1' : '0.4');
  icon.onclick = function(e: Event) {
    e.stopPropagation();
    const updated = { ...p, isFavorite: !isFav };
    sendToExtension('SAVE_PROMPT', { prompt: updated }).then(function(resp: Record<string, unknown>) {
      if (resp && resp.isOk) {
        log((!isFav ? 'Added to' : 'Removed from') + ' favorites: ' + p.name, 'success');
        showPasteToast((!isFav ? '⭐ Favorited: ' : '☆ Unfavorited: ') + p.name, false);
        clearLoadedPrompts();
        clearUISnapshot();
        loadPromptsFromJson().then(function() { renderPromptsDropdown(ctx, taskNextDeps); });
      }
    });
  };
  return icon;
}

/** Assemble an EditablePrompt object, omitting optional keys when their source value is undefined (required by exactOptionalPropertyTypes). */
function _buildEditablePromptFromEntry(p: PromptEntry): EditablePrompt {
  const out: EditablePrompt = { name: p.name, text: p.text };
  if (typeof p.id === 'string') out.id = p.id;
  if (typeof p.category === 'string') out.category = p.category;
  if (typeof p.isDefault === 'boolean') out.isDefault = p.isDefault;
  const exc = (p as { excludeFromExport?: boolean }).excludeFromExport;
  if (typeof exc === 'boolean') out.excludeFromExport = exc;
  return out;
}

/** Build the edit ✏️ action icon for a prompt item. */
function _buildEditIcon(p: PromptEntry, dropdown: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): HTMLElement {
  const icon = _makeActionIcon('✏️', 'Edit prompt', '0.6');
  icon.onclick = function(e: Event) {
    e.stopPropagation();
    dropdown.style.display = 'none';
    openPromptCreationModal(ctx, taskNextDeps, _buildEditablePromptFromEntry(p));
  };
  return icon;
}

/** Build the delete 🗑️ action icon for a prompt item. */
function _buildDeleteIcon(p: PromptEntry, dropdown: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): HTMLElement {
  const icon = _makeActionIcon('🗑️', 'Delete prompt', '0.6');
  icon.onclick = function(e: Event) {
    e.stopPropagation();
    if (!confirm('Delete prompt "' + p.name + '"?')) return;
    _executeDeletePrompt(p, dropdown, ctx, taskNextDeps);
  };
  return icon;
}

/** Execute prompt deletion via extension message. */
function _executeDeletePrompt(p: PromptEntry, _dropdown: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  sendToExtension('DELETE_PROMPT', { promptId: p.id }).then(function(resp: ExtensionResponse) {
    if (resp && resp.isOk) {
      handlePromptDeleteSuccess(p, ctx, taskNextDeps);
      return;
    }
    handlePromptDeleteFailure(p, resp?.errorMessage ?? 'DELETE_PROMPT returned no success flag');
  }).catch(function(caught: CaughtError) { handlePromptDeleteFailure(p, toErrorMessage(caught), caught); });
}

function handlePromptDeleteSuccess(p: PromptEntry, ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  log('Deleted prompt: ' + p.name, 'success');
  showPasteToast('🗑️ Deleted: ' + p.name, false);
  clearLoadedPrompts();
  clearUISnapshot();
  // Also purge the row from the IndexedDB JsonCopy so Export (which reads
  // JsonCopy alongside the DB) can never leak a just-deleted prompt back
  // into the download. Matching is defensive: id → slug → name.
  void import('./prompt-cache').then(function(mod) {
    return mod.readJsonCopy().then(function(record) {
      if (!record || !record.entries || record.entries.length === 0) return;
      const filtered = record.entries.filter(function(e) {
        if (p.id && e.id === p.id) return false;
        if (p.slug && e.slug === p.slug) return false;
        if (!p.id && !p.slug && e.name === p.name) return false;
        return true;
      });
      if (filtered.length !== record.entries.length) {
        return mod.writeJsonCopy(filtered);
      }
      return undefined;
    });
  }).catch(function(cacheErr: unknown) {
    log('[PromptDelete] JsonCopy purge failed: ' + String(cacheErr), 'warn');
  });
  loadPromptsFromJson().then(function() { renderPromptsDropdown(ctx, taskNextDeps); });
}

export function handlePromptDeleteFailure(p: PromptEntry, reason: string, caught?: CaughtError): void {
  logDiagnosticFromCode('DB_WRITE_E004', { promptId: toDiagnosticId(p.id), name: toDiagnosticId(p.name), reason }, caught);
  showPasteToast('❌ Delete failed: ' + reason, true);
}

/** Build the copy 📋 action icon for a prompt item. */
function _buildCopyIcon(p: PromptEntry): HTMLElement {
  const icon = _makeActionIcon('📋', 'Copy to clipboard', '0.7');
  icon.style.fontSize = '11px';
  icon.onclick = function(e: Event) {
    e.stopPropagation();
    navigator.clipboard.writeText(p.text).then(function() {
      log('Prompt copied: ' + p.name, 'success');
      icon.textContent = '✅';
      setTimeout(function() { icon.textContent = '📋'; }, 1500);
    });
  };
  return icon;
}

/** Create a styled action icon span with hover opacity. */
function _makeActionIcon(emoji: string, title: string, baseOpacity: string): HTMLElement {
  const icon = document.createElement('span');
  icon.textContent = emoji;
  icon.title = title;
  icon.style.cssText = 'cursor:pointer;font-size:13px;opacity:' + baseOpacity + ';';
  icon.onmouseover = function() { (this as HTMLElement).style.opacity = '1'; };
  icon.onmouseout = function() { (this as HTMLElement).style.opacity = baseOpacity + ';'; };
  return icon;
}

function buildAddPromptButton(promptsDropdown: HTMLElement, ctx: PromptContext, taskNextDeps: TaskNextDeps): HTMLElement {
  const addBtn = document.createElement('div');
  addBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:8px;cursor:pointer;font-size:13px;color:' + cPrimaryLight + ';border-top:1px solid rgba(124,58,237,0.3);';
  addBtn.textContent = '➕ Add New Prompt';
  addBtn.onmouseover = function() { (this as HTMLElement).style.background = 'rgba(139,92,246,0.2)'; };
  addBtn.onmouseout = function() { (this as HTMLElement).style.background = 'transparent'; };
  addBtn.onclick = function(e: Event) {
    e.stopPropagation();
    promptsDropdown.style.display = 'none';
    openPromptCreationModal(ctx, taskNextDeps, null);
  };
  return addBtn;
}
