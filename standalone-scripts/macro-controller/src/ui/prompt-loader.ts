/**
 * Prompt Loader — Loading, caching, config resolution, extension messaging
 *
 * Phase 5D split from ui/prompt-manager.ts.
 * See: spec/04-macro-controller/ts-migration-v2/05-module-splitting.md
 */

import { log } from '../logger';
import { sendToExtension } from './extension-relay';
import type { ExtensionResponse, PromptEntry, ResolvedPromptsConfig } from '../types';
import type { PromptRole } from '../types/prompt-role';
import type { CachedPromptEntry } from './prompt-cache';
import {
  clearPromptCache,
  clearUISnapshot,
  readPromptCache,
  writePromptCache,
  writeHtmlCopy,
} from './prompt-cache';
import type { TaskNextDeps } from './task-next-ui';
import { normalizePromptEntries } from './prompt-utils';
import { logError } from '../error-utils';
import { showToast } from '../toast';
import { DEFAULT_PASTE_XPATH } from '../constants';
import bundledPromptBundle from '../../03-macro-prompts.json';
/** Editable prompt — a PromptEntry with an optional DB id. */
export interface EditablePrompt extends PromptEntry {
  id?: string;
  role?: PromptRole;
  replaceKey?: string;
  replaceValues?: string[];
}

/** Context type for DOM refs from createUI() */
export interface PromptContext {
  promptsDropdown: HTMLElement;
}

// ============================================
// Fallback prompts
// ============================================
export const DEFAULT_PROMPTS: PromptEntry[] = loadFallbackPromptEntries();
type BundledPromptEntry = Partial<PromptEntry & { order?: number }>;

interface BundledPromptBundle {
  prompts?: BundledPromptEntry[];
}

function loadFallbackPromptEntries(): PromptEntry[] {
  const bundle = bundledPromptBundle as BundledPromptBundle;
  const entries = Array.isArray(bundle.prompts) ? bundle.prompts : [];
  return normalizePromptEntries(entries);
}

// ============================================
// PromptLoaderState — encapsulated module state (CQ11, CQ17)
//
// Conversion (CQ10):
//   Before: 5 module-level `let` vars (_loadedJsonPrompts, _jsonPromptsLoading,
//           _promptCategoryFilter, _revalidateCtx, _renderDropdownFn).
//   After:  `PromptLoaderState` singleton class with private fields and getters/setters.
// ============================================

class PromptLoaderState {
  private _loadedJsonPrompts: PromptEntry[] | null = null;
  private _jsonPromptsLoading = false;
  private _promptCategoryFilter: string | null = null;
  private _revalidateCtx: { ctx: PromptContext; taskNextDeps: TaskNextDeps } | null = null;
  private _renderDropdownFn: ((ctx: PromptContext, deps: TaskNextDeps) => void) | null = null;
  private _pendingCallbacks: Array<(prompts: PromptEntry[] | null) => void> = [];

  get loadedJsonPrompts(): PromptEntry[] | null { return this._loadedJsonPrompts; }
  set loadedJsonPrompts(value: PromptEntry[] | null) { this._loadedJsonPrompts = value; }

  get jsonPromptsLoading(): boolean { return this._jsonPromptsLoading; }
  set jsonPromptsLoading(value: boolean) { this._jsonPromptsLoading = value; }

  get promptCategoryFilter(): string | null { return this._promptCategoryFilter; }
  set promptCategoryFilter(value: string | null) { this._promptCategoryFilter = value; }

  get revalidateCtx(): { ctx: PromptContext; taskNextDeps: TaskNextDeps } | null { return this._revalidateCtx; }
  set revalidateCtx(value: { ctx: PromptContext; taskNextDeps: TaskNextDeps } | null) { this._revalidateCtx = value; }

  get renderDropdownFn(): ((ctx: PromptContext, deps: TaskNextDeps) => void) | null { return this._renderDropdownFn; }
  set renderDropdownFn(value: ((ctx: PromptContext, deps: TaskNextDeps) => void) | null) { this._renderDropdownFn = value; }

  enqueuePendingCallback(callback: (prompts: PromptEntry[] | null) => void): void {
    this._pendingCallbacks.push(callback);
  }

  flushPendingCallbacks(prompts: PromptEntry[] | null): void {
    const pending = this._pendingCallbacks.slice();
    this._pendingCallbacks = [];
    for (const callback of pending) {
      try {
        callback(prompts);
      } catch (e) {
        logError('parsePromptFile', 'Prompt callback execution failed', e);
        showToast('❌ Prompt callback failed', 'error');
      }
    }
  }
}

const promptLoaderState = new PromptLoaderState();

/** @deprecated Use promptLoaderState.promptCategoryFilter directly. */
export const _promptCategoryFilter: string | null = null;
export function getPromptCategoryFilter(): string | null { return promptLoaderState.promptCategoryFilter; }
export function setPromptCategoryFilter(value: string | null): void {
  promptLoaderState.promptCategoryFilter = value;
}

// ── Multi-select category filter (new — used by Filter button menu) ──
const promptCategoryFilterSet: Set<string> = new Set<string>();
/** Read current multi-select category filter (lowercased values). */
export function getPromptCategoryFilterSet(): Set<string> { return promptCategoryFilterSet; }
/** Toggle one category in the filter set. */
export function togglePromptCategoryFilter(catLower: string): void {
  if (promptCategoryFilterSet.has(catLower)) promptCategoryFilterSet.delete(catLower);
  else promptCategoryFilterSet.add(catLower);
}
/** Remove every category from the filter set. */
export function clearPromptCategoryFilterSet(): void { promptCategoryFilterSet.clear(); }

/** Invalidate prompt cache (e.g. after save/delete) */
export function invalidatePromptCache(): void {
  promptLoaderState.loadedJsonPrompts = null;
  // Also invalidate SDK cache if available
  const sdk = window.marco as { prompts?: { invalidateCache(): Promise<void> } } | undefined;
  if (sdk && sdk.prompts && typeof sdk.prompts.invalidateCache === 'function') {
    sdk.prompts.invalidateCache().catch(function(e: unknown) { log('[PromptLoader] SDK cache invalidation failed: ' + (e instanceof Error ? e.message : String(e)), 'warn'); });
  }
  clearPromptCache().then(function() {
    log('[PromptCache] Cache cleared (invalidated)', 'info');
  });
  clearUISnapshot().then(function() {
    log('[UISnapshot] Snapshot cleared (invalidated)', 'info');
  });
}

/** Check if prompts are already loaded in memory */
export function isPromptsCached(): boolean {
  return promptLoaderState.loadedJsonPrompts !== null && promptLoaderState.loadedJsonPrompts.length > 0;
}

/** Clear in-memory loaded prompts (used after save/delete) */
export function clearLoadedPrompts(): void {
  promptLoaderState.loadedJsonPrompts = null;
  // Also invalidate SDK cache
  const sdk = window.marco as { prompts?: { invalidateCache(): Promise<void> } } | undefined;
  if (sdk && sdk.prompts && typeof sdk.prompts.invalidateCache === 'function') {
    sdk.prompts.invalidateCache().catch(function(e: unknown) { log('[PromptLoader] SDK cache invalidation failed: ' + (e instanceof Error ? e.message : String(e)), 'warn'); });
  }
}

// ============================================
// Extension relay
// ============================================
// `sendToExtension` moved to `./extension-relay.ts` in Plan-17 step 10
// to break the toast <-> error-overlay <-> prompt-loader runtime cycle.
// Re-exported here for backward compatibility with existing consumers.
export { sendToExtension };

// ============================================
// Prompt loading
// ============================================

/**
 * Try loading prompts via chrome.runtime or relay, returns Promise.
 */
function tryLoadByMessage(type: string): Promise<PromptEntry[] | null> {
  return sendToExtension(type, {}).then(function(response: ExtensionResponse) {
    if (!response) return null;
    const prompts = normalizePromptEntries((response.prompts) as Partial<PromptEntry>[]);
    return prompts.length > 0 ? prompts : null;
  });
}

export function setRevalidateContext(ctx: PromptContext, taskNextDeps: TaskNextDeps): void {
  promptLoaderState.revalidateCtx = { ctx, taskNextDeps };
}

/**
 * Read the last-registered `(ctx, taskNextDeps)` pair. Used by the shared
 * `openPromptEditor` wrapper so per-chip entry points can reuse the single
 * `openPromptCreationModal` editor without threading a new context through
 * every call site. Returns `null` before the dropdown has been rendered.
 */
export function getRevalidateContext(): { ctx: PromptContext; taskNextDeps: TaskNextDeps } | null {
  return promptLoaderState.revalidateCtx;
}

/** Register the renderPromptsDropdown function (called from prompt-dropdown to break circular dep) */
export function setRenderDropdownFn(fn: (ctx: PromptContext, deps: TaskNextDeps) => void): void {
  promptLoaderState.renderDropdownFn = fn;
}

/**
 * Trigger a full re-render of the main prompts dropdown using the last-registered
 * context (from setRevalidateContext) and renderer (from setRenderDropdownFn).
 * Used by CRUD flows (save / delete / rename) to refresh the list after mutation.
 */
export function rerenderPromptsDropdown(): void {
  const fn = promptLoaderState.renderDropdownFn;
  const c = promptLoaderState.revalidateCtx;
  if (!fn || !c) return;
  try { fn(c.ctx, c.taskNextDeps); }
  catch (e) { logError('rerenderPromptsDropdown', 'Re-render failed', e); }
}

// CQ16: Extracted from loadPromptsFromJson legacy path closure
function finishLegacyLoad(
  prompts: PromptEntry[] | null,
  source: string,
): PromptEntry[] | null {
  promptLoaderState.jsonPromptsLoading = false;
  if (prompts && prompts.length > 0) {
    promptLoaderState.loadedJsonPrompts = prompts;
    log('Loaded ' + prompts.length + ' prompts from ' + source, 'success');
    writePromptCache(prompts as CachedPromptEntry[]).then(function() {
      log('[PromptCache] Cached ' + prompts.length + ' prompts to IndexedDB', 'info');
    });
    promptLoaderState.flushPendingCallbacks(promptLoaderState.loadedJsonPrompts);
    return promptLoaderState.loadedJsonPrompts;
  }
  promptLoaderState.flushPendingCallbacks(null);
  return null;
}

 
function handleSdkSuccess(entries: unknown[], loadStartMs: number): PromptEntry[] {
  const prompts = normalizePromptEntries(entries as Partial<PromptEntry>[]);
  const elapsed = Date.now() - loadStartMs;
  if (prompts.length > 0) {
    promptLoaderState.loadedJsonPrompts = prompts;
    log('[PromptLoad] ✅ SDK returned ' + prompts.length + ' prompts (' + elapsed + 'ms)', 'success');
    writePromptCache(prompts as CachedPromptEntry[]).catch(function(cacheErr: unknown) {
      logError('loadPromptsFromJson.sdk', 'JsonCopy sync after SDK fetch failed', cacheErr);
    });
    promptLoaderState.flushPendingCallbacks(prompts);
    return prompts;
  }
  log('[PromptLoad] ⚠️ SDK returned empty, falling back to defaults (' + elapsed + 'ms)', 'warn');
  const defaults = loadFallbackPromptEntries();
  promptLoaderState.loadedJsonPrompts = defaults;
  writePromptCache(defaults as CachedPromptEntry[]).catch(function(cacheErr: unknown) {
    logError('loadPromptsFromJson.sdk', 'JsonCopy sync (empty to defaults) failed', cacheErr);
  });
  promptLoaderState.flushPendingCallbacks(defaults);
  return defaults;
}

function handleSdkFailure(e: unknown, loadStartMs: number): PromptEntry[] {
  const elapsed = Date.now() - loadStartMs;
  log('[PromptLoad] ❌ SDK prompts.getAll() failed (' + elapsed + 'ms): ' + (e instanceof Error ? e.message : String(e)) + ', using defaults', 'warn');
  const defaults = loadFallbackPromptEntries();
  promptLoaderState.loadedJsonPrompts = defaults;
  promptLoaderState.flushPendingCallbacks(defaults);
  return defaults;
}

function loadViaSdk(sdkPrompts: { getAll(): Promise<unknown[]> }, loadStartMs: number): Promise<PromptEntry[] | null> {
  if (promptLoaderState.loadedJsonPrompts) {
    log('[PromptLoad] ✅ In-memory cache hit (' + promptLoaderState.loadedJsonPrompts.length + ' prompts, 0ms)', 'info');
    return Promise.resolve(promptLoaderState.loadedJsonPrompts);
  }
  log('[PromptLoad] Fetching via SDK marco.prompts.getAll()...', 'info');
  return sdkPrompts.getAll()
    .then(function(entries: unknown[]) { return handleSdkSuccess(entries, loadStartMs); })
    .catch(function(e: unknown) { return handleSdkFailure(e, loadStartMs); });
}

export function loadPromptsFromJson(): Promise<PromptEntry[] | null> {
  const loadStartMs = Date.now();

  const sdk = window.marco as { prompts?: { getAll(): Promise<unknown[]> } } | undefined;
  if (sdk && sdk.prompts && typeof sdk.prompts.getAll === 'function') {
    return loadViaSdk(sdk.prompts, loadStartMs);
  }


  // ── Legacy path (SDK not available) ──
  log('[PromptLoad] SDK not available — using legacy load path', 'info');

  // 1. In-memory cache
  if (promptLoaderState.loadedJsonPrompts) {
    log('[PromptLoad] ✅ In-memory cache hit (' + promptLoaderState.loadedJsonPrompts.length + ' prompts, 0ms)', 'info');
    return Promise.resolve(promptLoaderState.loadedJsonPrompts);
  }
  if (promptLoaderState.jsonPromptsLoading) {
    return new Promise<PromptEntry[] | null>(function(resolve) {
      promptLoaderState.enqueuePendingCallback(resolve);
    });
  }
  promptLoaderState.jsonPromptsLoading = true;

  // 2. Try IndexedDB cache first (instant) — no SWR, no background revalidation
  return readPromptCache().then(function(cached) {
    if (cached && cached.entries && cached.entries.length > 0) {
      promptLoaderState.loadedJsonPrompts = cached.entries as PromptEntry[];
      promptLoaderState.jsonPromptsLoading = false;
      const age = Math.round((Date.now() - cached.fetchedAt) / 1000);
      log('[PromptCache] Loaded ' + cached.entries.length + ' prompts from IndexedDB JsonCopy (age=' + age + 's)', 'success');
      promptLoaderState.flushPendingCallbacks(promptLoaderState.loadedJsonPrompts);

      return promptLoaderState.loadedJsonPrompts;
    }

    // No cache — fetch directly from extension
    log('[PromptCache] No IndexedDB cache — fetching from extension...', 'info');

    return fetchAndCacheFromExtension();
  }).catch(function(e: unknown) {
    logError('loadPrompts', 'Prompt loading failed', e);
    showToast('❌ Prompt loading failed', 'error');
    return fetchAndCacheFromExtension();
  });
}

// ============================================
// Extension fetch with fallback chain
// ============================================

/** Fetch from extension, fall back to preamble or defaults. */
function fetchAndCacheFromExtension(): Promise<PromptEntry[] | null> {
  return tryLoadByMessage('GET_PROMPTS').then(function(prompts: PromptEntry[] | null) {
    if (prompts && prompts.length > 0) {
      return finishLegacyLoad(prompts, 'extension bridge GET_PROMPTS (SQLite)');
    }

    return loadFromPreambleOrDefaults();
  });
}

/** Try __MARCO_PROMPTS__ preamble, then hardcoded defaults. */
function loadFromPreambleOrDefaults(): PromptEntry[] | null {
  const preamble = window.__MARCO_PROMPTS__;
  const hasPreamble = preamble && Array.isArray(preamble) && preamble.length > 0;

  if (hasPreamble) {
    return finishLegacyLoad(normalizePromptEntries(preamble), '__MARCO_PROMPTS__ preamble');
  }

  log('No prompts from bridge or preamble — using bundled fallback prompts', 'warn');

  return finishLegacyLoad(loadFallbackPromptEntries(), 'bundled fallback prompts');
}

// ============================================
// Manual Load — forceLoadFromDb
// ============================================

/**
 * Force-load prompts from the extension DB (bypasses in-memory + IndexedDB cache).
 * Called by the "Load" button in the prompt dropdown header.
 */
export function forceLoadFromDb(): Promise<PromptEntry[] | null> {
  log('[PromptLoad] Manual load triggered — clearing caches and fetching from DB...', 'check');
  promptLoaderState.loadedJsonPrompts = null;
  promptLoaderState.jsonPromptsLoading = false;

  return clearPromptCache()
    .then(function() { return clearUISnapshot(); })
    .then(function() { return tryLoadByMessage('GET_PROMPTS'); })
    .then(function(prompts: PromptEntry[] | null) {
      return handleForceLoadResult(prompts);
    });
}

/** Process force-load result and cache it. */
function handleForceLoadResult(prompts: PromptEntry[] | null): PromptEntry[] | null {
  if (prompts && prompts.length > 0) {
    return finishLegacyLoad(prompts, 'manual load from DB');
  }

  log('[PromptLoad] Manual load returned empty — using defaults', 'warn');

  return finishLegacyLoad(loadFallbackPromptEntries(), 'defaults (manual load empty)');
}

// ============================================
// HTML Copy — save rendered dropdown HTML for MacroController
// ============================================

/** Save rendered dropdown HTML as HtmlCopy in IndexedDB. */
export function saveHtmlCopy(options: { html: string; promptCount: number; dataHash: string }): Promise<void> {
  return writeHtmlCopy(options);
}

/**
 * Resolve prompts config from multiple sources.
 */
export function getPromptsConfig(): ResolvedPromptsConfig {
  const promptsCfg = (window.__MARCO_CONFIG__ || {}).prompts || {};
  const rawEntries = (promptsCfg.entries || promptsCfg.prompts || []) as Array<Partial<PromptEntry> & { id?: string; isDefault?: boolean }>;
  let entries: PromptEntry[] = normalizePromptEntries(Array.isArray(rawEntries) ? rawEntries : []);

  const loaded = promptLoaderState.loadedJsonPrompts;

  if (loaded && loaded.length > 0) {
    const merged: PromptEntry[] = loaded.slice();
    const seen: Record<string, boolean> = {};
    for (const prompt of merged) {
      seen[(prompt.name || '').toLowerCase()] = true;
    }

    for (const p of entries) {
      const key = (p.name || '').toLowerCase();

      if (p.name && p.text && !seen[key]) {
        merged.push(p);
        seen[key] = true;
      }
    }
    entries = merged;
  }

  if (entries.length === 0) {
    entries = loadFallbackPromptEntries();
  }

  return {
    entries: entries,
    pasteTargetXPath: promptsCfg.pasteTargetXPath || (promptsCfg.pasteTarget && promptsCfg.pasteTarget.xpath) || DEFAULT_PASTE_XPATH,
    pasteTargetSelector: promptsCfg.pasteTargetSelector || (promptsCfg.pasteTarget && promptsCfg.pasteTarget.selector) || ''
  };
}

/** Get contextually suggested prompts. */
export function getSuggestedPrompts(allEntries: PromptEntry[]): PromptEntry[] {
  const currentTags = (window as unknown as { RiseupAsiaMacroExt?: { Projects?: { MacroController?: { meta?: { tags?: string[] } } } } }).RiseupAsiaMacroExt?.Projects?.MacroController?.meta?.tags || [];
  
  if (currentTags.length === 0) {
    // Fallback: recently used or favorites
    return allEntries.filter(p => p.isFavorite).slice(0, 3);
  }

  return allEntries.filter(p => {
    if (!p.tags || p.tags.length === 0) return false;
    return p.tags.some((t: string) => currentTags.includes(t.toLowerCase()));
  }).slice(0, 5);
}

