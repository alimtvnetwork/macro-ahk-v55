/**
 * Prompt IO, Core Logic & Types (Issue 131).
 *
 * Handles parsing, validation, and the upsert-merge strategy for the
 * prompts import/export flow. As of plan 12 step 5, JSON exports emit
 * the shared `PromptsBundleV1` envelope from `prompt-bundle-types.ts`
 * so JSON, ZIP, and SQLite exporters stay in sync. Plan 12 step 6 wires
 * `parsePromptsText()` to accept both the new envelope and legacy bare
 * arrays produced by pre-v4.35 builds.
 */

import { CachedPromptEntry, readJsonCopy } from './prompt-cache';
import { log } from '../logger';
import { showToast } from '../toast';
import { VERSION } from '../shared-state';
import { buildPromptsBundle, validatePromptsBundle, type BundleRevisionRow, type PromptsBundleV1 } from './prompt-bundle-types';
import { isPromptRole, type PromptRole } from '../types/prompt-role';
import { listPromptRevisions, insertImportedRevisions } from '../db/prompt-revision-db';

/**
 * Options for `exportPromptsToJson`.
 *
 * v4.190.0: `includeRevisions` opt-in attaches per-slug revision history
 * (via `listPromptRevisions`) to the bundle under `revisions[]`. Default is
 * `false` so pre-v4.190 exports remain byte-identical. Failures collecting
 * a single slug's history are logged and skipped, never fatal to the export.
 */
export interface ExportPromptsOptions {
  includeRevisions?: boolean;
}

/**
 * Exports current prompts from IndexedDB as a JSON file download using
 * the shared `PromptsBundleV1` envelope (plan 12 step 5).
 */
export async function exportPromptsToJson(options: ExportPromptsOptions = {}): Promise<void> {
  try {
    const entries = await collectAllExportEntries();
    if (entries.length === 0) {
      showToast('No prompts found to export', 'warn');
      return;
    }

    const revisions = options.includeRevisions ? await collectRevisionsForEntries(entries) : undefined;
    const { getEffectivePromptOrder } = await import('./prompt-drag-order');
    const promptOrder = getEffectivePromptOrder();
    const bundle = buildPromptsBundle(entries, VERSION, {
      format: 'json',
      ...(revisions && revisions.length > 0 ? { revisions } : {}),
      ...(promptOrder.length > 0 ? { promptOrder } : {}),
    });
    const skipped = entries.length - bundle.entryCount;
    if (bundle.entryCount === 0) {
      showToast('All prompts are flagged excludeFromExport, nothing to export', 'warn');
      return;
    }

    const data = JSON.stringify(bundle, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    const suffix = skipped > 0 ? ` (${skipped} excluded)` : '';
    const revSuffix = bundle.revisions && bundle.revisions.length > 0
      ? ` + ${bundle.revisions.length} revisions`
      : '';
    showToast(`Exported ${bundle.entryCount} prompts${suffix}${revSuffix}`, 'success');
  } catch (err) {
    log('[PromptIO] Export failed: ' + String(err), 'error');
    showToast('Export failed', 'error');
  }
}

/**
 * Fetch revision history for every entry that carries a `slug`. Entries
 * with no slug (legacy cache-only rows) cannot have SQLite history and are
 * skipped silently. Per-slug failures are logged and dropped, never fatal.
 */
async function collectRevisionsForEntries(entries: CachedPromptEntry[]): Promise<BundleRevisionRow[]> {
  const out: BundleRevisionRow[] = [];
  const seenSlugs = new Set<string>();
  for (const e of entries) {
    const slug = e.slug;
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const res = await listPromptRevisions(slug);
    if (!res.ok || !res.value) {
      log('[PromptIO] revision fetch failed for slug=' + slug + ': ' + (res.error ?? 'unknown'), 'warn');
      continue;
    }
    for (const r of res.value) {
      out.push({
        Slug: r.Slug,
        Name: r.Name,
        Body: r.Body,
        Role: r.Role,
        ReplaceKey: r.ReplaceKey,
        ReplaceValues: r.ReplaceValues,
        CreatedAt: r.CreatedAt,
        Reason: r.Reason,
      });
    }
  }
  return out;
}


export interface PromptImportResults {
  added: number;
  updated: number;
  total: number;
  errors: string[];
  /**
   * v4.192.0: number of revision rows successfully inserted by
   * `performPromptImport` via `insertImportedRevisions`. Mirrors the
   * history-panel import capability at the collection level so the modal
   * can surface "+N revisions" in its success summary.
   */
  revisionsImported?: number;
}


/**
 * Untyped raw shape used while validating unknown JSON input. Declaring
 * each field explicitly (instead of `Record<string, unknown>`) keeps
 * dot access legal under `noPropertyAccessFromIndexSignature`.
 */
interface LoosePromptShape {
  name?: unknown;
  text?: unknown;
  category?: unknown;
  slug?: unknown;
  order?: unknown;
  version?: unknown;
  excludeFromExport?: unknown;
  role?: unknown;
  isFavorite?: unknown;
  isDefault?: unknown;
  id?: unknown;
  tags?: unknown;
  isDynamic?: unknown;
  replaceKey?: unknown;
  replaceValues?: unknown;
  slugTemplate?: unknown;
  parentTitle?: unknown;
  parentSlug?: unknown;
  variantValue?: unknown;
}

/**
 * Validates that an object matches the CachedPromptEntry schema.
 * Sanitizes fields to ensure consistency. Preserves dynamic-expansion
 * fields (plan 12 step 6): `tags`, `id`, `isDynamic`, `replaceKey`,
 * `replaceValues`, `slugTemplate`, `parentTitle`, `parentSlug`,
 * `variantValue`. Retiring the old lossy shape closes the round-trip
 * gap flagged in notes-01-call-graph.md.
 */
function setLoose(target: object, key: string, value: unknown): void {
  (target as Record<string, unknown>)[key] = value;
}

function preserveDynamicFields(e: LoosePromptShape, loose: CachedPromptEntry): void {
  if (typeof e.id === 'string') setLoose(loose, 'id', e.id);
  if (Array.isArray(e.tags)) setLoose(loose, 'tags', e.tags.filter((t) => typeof t === 'string'));
  if (typeof e.isDynamic === 'boolean') setLoose(loose, 'isDynamic', e.isDynamic);
  if (typeof e.replaceKey === 'string') setLoose(loose, 'replaceKey', e.replaceKey);
  if (Array.isArray(e.replaceValues)) {
    setLoose(loose, 'replaceValues', e.replaceValues.filter((v) => typeof v === 'string'));
  }
  if (typeof e.slugTemplate === 'string') setLoose(loose, 'slugTemplate', e.slugTemplate);
  if (typeof e.parentTitle === 'string') setLoose(loose, 'parentTitle', e.parentTitle);
  if (typeof e.parentSlug === 'string') setLoose(loose, 'parentSlug', e.parentSlug);
  if (typeof e.variantValue === 'string') setLoose(loose, 'variantValue', e.variantValue);
}

export function validatePromptEntry(entry: unknown): CachedPromptEntry | null {
  return validatePromptEntryDetailed(entry).entry;
}

/**
 * Detailed variant that names the failing field so callers can emit
 * JSON-pointer-style error messages (e.g. `/entries/3/name`).
 */
export function validatePromptEntryDetailed(
  entry: unknown
): { entry: CachedPromptEntry | null; field: string | null; reason: string | null } {
  if (!entry || typeof entry !== 'object') {
    return { entry: null, field: '', reason: 'not an object' };
  }
  const e = entry as LoosePromptShape;
  if (typeof e.name !== 'string' || !e.name.trim()) {
    return { entry: null, field: 'name', reason: 'missing or empty string' };
  }
  if (typeof e.text !== 'string') {
    return { entry: null, field: 'text', reason: 'missing or not a string' };
  }

  const out: CachedPromptEntry = {
    name: e.name.trim(),
    text: e.text,
    category: typeof e.category === 'string' ? e.category.trim() : 'General',
    isFavorite: !!e.isFavorite,
    isDefault: !!e.isDefault,
  };
  if (typeof e.slug === 'string') out.slug = e.slug.trim();
  if (typeof e.order === 'number') out.order = e.order;
  if (typeof e.version === 'string') out.version = e.version;
  if (typeof e.excludeFromExport === 'boolean') out.excludeFromExport = e.excludeFromExport;
  if (isPromptRole(e.role)) out.role = e.role;
  preserveDynamicFields(e, out);
  return { entry: out, field: null, reason: null };
}


/**
 * Plan-14 step 13: merge JSON-cache entries with DB rows so exports carry
 * user-edited plan/next/generic prompts. DB rows win on slug collisions.
 * Kept as a small helper so ZIP / SQLite exporters can share it.
 */
export async function collectAllExportEntries(): Promise<CachedPromptEntry[]> {
  const record = await readJsonCopy();
  const cacheEntries = record && record.entries ? record.entries : [];
  const bridge = await import('./prompt-io-db-bridge');
  const dbEntries = await bridge.collectDbEntriesForExport();
  return bridge.mergeDbIntoExport(cacheEntries, dbEntries);
}

/**
 * Merges imported prompts into the existing set.
 * Strategy: If slug matches (or name matches if no slug), overwrite. Otherwise append.
 */
export function mergePrompts(
  existing: CachedPromptEntry[],
  imported: CachedPromptEntry[],
  overwrite: boolean = true
): { merged: CachedPromptEntry[]; results: PromptImportResults } {

  const results: PromptImportResults = { added: 0, updated: 0, total: imported.length, errors: [] };
  const mergedMap = new Map<string, CachedPromptEntry>();

  existing.forEach((entry) => {
    const key = entry.slug || entry.name;
    mergedMap.set(key, entry);
  });

  imported.forEach((imp) => {
    const key = imp.slug || imp.name;
    if (mergedMap.has(key)) {
      if (overwrite) {
        results.updated++;
        mergedMap.set(key, imp);
      }
    } else {
      results.added++;
      mergedMap.set(key, imp);
    }

  });

  return { merged: Array.from(mergedMap.values()), results };
}

/**
 * Parses a JSON string and validates its contents.
 *
 * Plan 12 step 6: accepts three shapes and returns a normalized
 * `CachedPromptEntry[]` for the merger:
 *   1. `PromptsBundleV1` envelope (preferred, produced by v4.35+).
 *   2. Bare `PromptEntry[]` array (legacy pre-v4.35 export).
 *   3. Single `PromptEntry` object (drag-drop convenience).
 */
export interface ParsedPromptsResult {
  valid: CachedPromptEntry[];
  errors: string[];
  /**
   * Revision-history rows preserved from a `PromptsBundleV1` envelope
   * (v4.190.0). `undefined` for legacy bare-array shapes and for bundles
   * without a `revisions` field.
   */
  revisions?: BundleRevisionRow[];
  /**
   * User-visible display order preserved from a `PromptsBundleV1` envelope
   * (v4.383.0). Legacy bare-array bundles do not carry this field.
   */
  promptOrder?: string[];
}

function parseBundleEnvelope(raw: unknown, valid: CachedPromptEntry[], errors: string[]): ParsedPromptsResult {
  const rawEntries = (raw as { entries?: unknown }).entries;
  const result = validatePromptsBundle(raw);
  if (!result.isValid || !result.bundle) {
    if (Array.isArray(rawEntries)) {
      rawEntries.forEach((entry, index) => {
        const detail = validatePromptEntryDetailed(entry);
        if (!detail.entry) {
          const ptr = detail.field ? `/entries/${index}/${detail.field}` : `/entries/${index}`;
          errors.push(`${ptr}: ${detail.reason ?? 'invalid'} (requires name and text)`);
        }
      });
    }
    if (errors.length === 0) errors.push(...result.errors);
    return { valid, errors };
  }
  result.bundle.entries.forEach((entry, index) => {
    const detail = validatePromptEntryDetailed(entry);
    if (detail.entry) {
      valid.push(detail.entry);
    } else {
      const ptr = detail.field ? `/entries/${index}/${detail.field}` : `/entries/${index}`;
      errors.push(`${ptr}: ${detail.reason ?? 'invalid'} (requires name and text)`);
    }
  });
  const out: ParsedPromptsResult = { valid, errors };
  if (result.bundle.revisions && result.bundle.revisions.length > 0) {
    out.revisions = result.bundle.revisions;
  }
  if (result.bundle.promptOrder && result.bundle.promptOrder.length > 0) {
    out.promptOrder = result.bundle.promptOrder;
  }
  return out;
}

export function parsePromptsText(jsonText: string): ParsedPromptsResult {
  const valid: CachedPromptEntry[] = [];
  const errors: string[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (err) {
    errors.push('Failed to parse JSON: ' + (err instanceof Error ? err.message : String(err)));
    return { valid, errors };
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)
      && 'schemaVersion' in raw && 'entries' in raw) {
    return parseBundleEnvelope(raw, valid, errors);
  }


  // Shape 2 / 3: bare array or single object (legacy).
  const array = Array.isArray(raw) ? raw : [raw];
  array.forEach((item, index) => {
    const detail = validatePromptEntryDetailed(item);
    if (detail.entry) {
      valid.push(detail.entry);
    } else {
      const ptr = detail.field ? `/${index}/${detail.field}` : `/${index}`;
      errors.push(`Row ${index + 1} (${ptr}): ${detail.reason ?? 'invalid'} (requires name and text)`);
    }
  });


  return { valid, errors };
}

/**
 * Options for `performPromptImport`.
 *
 * v4.190.0:
 * - `roleFilter`: when set, entries whose `role` does not match are dropped
 *   (with the count reported via `PromptImportResults.errors`). This is the
 *   role-scoped bulk-import contract asked for on the backlog.
 * - `revisions`: revision rows carried in the source bundle. When present
 *   they are inserted via `insertImportedRevisions` grouped per slug. Rows
 *   whose slug is not among the committed DB entries are dropped and counted.
 *
 * v4.192.0:
 * - `onProgress`: fires at each observable milestone of a collection-level
 *   import so the caller (typically the Prompt Library modal) can render a
 *   live progress indicator. Emitted phases:
 *     - `entries` once after DB entries have been committed.
 *     - `revisions` once at the start of the per-slug insert loop (with
 *       `totalRevisions` and `totalGroups` known), then again after every
 *       `insertImportedRevisions` call with cumulative `insertedRevisions`
 *       and `groupsDone` counters plus the just-processed `slug`.
 *     - `done` once at the very end, whether or not revisions were present.
 *   Callback errors are caught and logged so a broken listener cannot abort
 *   the import.
 */
export interface ImportProgress {
  phase: 'entries' | 'revisions' | 'done';
  entriesCommitted: number;
  totalEntries: number;
  insertedRevisions: number;
  totalRevisions: number;
  groupsDone: number;
  totalGroups: number;
  slug?: string;
}

export interface PerformPromptImportOptions {
  overwrite?: boolean;
  roleFilter?: PromptRole;
  revisions?: BundleRevisionRow[];
  onProgress?: (p: ImportProgress) => void;
  /**
   * v4.383.0: when present, restore the user-visible display order into
   * `localStorage['marco.promptOrder.v1']` so imported bundles reproduce
   * the exporter's dropdown layout.
   */
  promptOrder?: string[];
}

/**
 * Apply a role filter to a list of imported entries. Returns the kept
 * entries plus a count of the dropped ones so the caller can surface
 * "X entries skipped (role mismatch)" without another traversal. Entries
 * with a missing/invalid role are treated as non-matching (dropped).
 *
 * Exported for unit tests and for callers that want to preview the
 * partition before committing.
 */
export function applyRoleFilter(
  entries: readonly CachedPromptEntry[],
  roleFilter: PromptRole | undefined,
): { kept: CachedPromptEntry[]; droppedCount: number } {
  if (!roleFilter) return { kept: [...entries], droppedCount: 0 };
  const kept: CachedPromptEntry[] = [];
  let droppedCount = 0;
  for (const e of entries) {
    if (isPromptRole(e.role) && e.role === roleFilter) kept.push(e);
    else droppedCount++;
  }
  return { kept, droppedCount };
}

/**
 * Orchestrates the full import process: read cache -> merge -> write cache.
 * When `options.revisions` is present, imported revision rows are inserted
 * per slug via `insertImportedRevisions` AFTER the entries themselves have
 * been committed, so foreign-slug references cannot occur.
 */
async function commitRevisions(
  revisionsIn: readonly BundleRevisionRow[],
  dbEntries: readonly CachedPromptEntry[],
  results: PromptImportResults,
  totalEntries: number,
  totalRevisionsInput: number,
  entriesCommitted: number,
  emit: (progress: ImportProgress) => void,
): Promise<void> {
  const committedSlugs = new Set(dbEntries.map((e) => e.slug).filter((s): s is string => !!s));
  const groups = new Map<string, BundleRevisionRow[]>();
  let orphanCount = 0;
  for (const r of revisionsIn) {
    if (!committedSlugs.has(r.Slug)) { orphanCount++; continue; }
    const bucket = groups.get(r.Slug);
    if (bucket) bucket.push(r); else groups.set(r.Slug, [r]);
  }
  const totalGroups = groups.size;
  const totalRevisions = Array.from(groups.values()).reduce((a, rows) => a + rows.length, 0);
  emit({ phase: 'revisions', entriesCommitted, totalEntries, insertedRevisions: 0, totalRevisions, groupsDone: 0, totalGroups });
  let inserted = 0;
  let groupsDone = 0;
  for (const [slug, rows] of groups) {
    const res = await insertImportedRevisions(slug, rows);
    if (res.ok) inserted += rows.length;
    else results.errors.push(`revisions for slug=${slug}: ${res.error ?? 'unknown'}`);
    groupsDone++;
    emit({ phase: 'revisions', entriesCommitted, totalEntries, insertedRevisions: inserted, totalRevisions, groupsDone, totalGroups, slug });
  }
  if (inserted > 0) results.revisionsImported = inserted;
  if (orphanCount > 0) results.errors.push(`${orphanCount} revision rows dropped (slug not in committed entries)`);
  void totalRevisionsInput;
}

export async function performPromptImport(
  importedPrompts: CachedPromptEntry[],
  options: PerformPromptImportOptions = {}
): Promise<PromptImportResults> {
  const totalRevisionsInput = options.revisions?.length ?? 0;
  const emit = (progress: ImportProgress): void => {
    if (!options.onProgress) return;
    try { options.onProgress(progress); }
    catch (err) { log('[PromptIO] onProgress listener threw: ' + String(err), 'warn'); }
  };
  const { kept, droppedCount } = applyRoleFilter(importedPrompts, options.roleFilter);
  const bridge = await import('./prompt-io-db-bridge');
  const { dbEntries, cacheEntries } = bridge.partitionByRole(kept);
  const dbResult = await bridge.commitDbEntries(dbEntries);

  const record = await readJsonCopy();
  const existing = record ? record.entries : [];
  const { merged, results } = mergePrompts(existing, cacheEntries, options.overwrite !== false);

  const { writeJsonCopy, clearPromptCache } = await import('./prompt-cache');
  await writeJsonCopy(merged);
  await clearPromptCache();

  const { invalidatePromptCache } = await import('./prompt-loader');
  invalidatePromptCache();

  results.total = importedPrompts.length;
  results.updated += dbResult.upserted;
  results.errors.push(...dbResult.errors);
  if (droppedCount > 0) {
    results.errors.push(`${droppedCount} entries skipped (roleFilter=${String(options.roleFilter)})`);
  }

  emit({
    phase: 'entries',
    entriesCommitted: dbResult.upserted,
    totalEntries: importedPrompts.length,
    insertedRevisions: 0,
    totalRevisions: totalRevisionsInput,
    groupsDone: 0,
    totalGroups: 0,
  });

  if (options.revisions && options.revisions.length > 0) {
    await commitRevisions(options.revisions, dbEntries, results, importedPrompts.length, totalRevisionsInput, dbResult.upserted, emit);
  }
  if (options.promptOrder && options.promptOrder.length > 0) {
    const { savePromptOrder } = await import('./prompt-drag-order');
    savePromptOrder(options.promptOrder.slice());
  }
  emit({
    phase: 'done',
    entriesCommitted: dbResult.upserted,
    totalEntries: importedPrompts.length,
    insertedRevisions: results.revisionsImported ?? 0,
    totalRevisions: totalRevisionsInput,
    groupsDone: 0,
    totalGroups: 0,
  });
  return results;
}

/**
 * Preview counts for an import without touching the database or JSON cache.
 * Mirrors the partitioning logic in `performPromptImport` so the UI can show
 * "N new, M updated, K revisions" before the user confirms.
 */
export interface PromptImportPreview {
  totalInput: number;
  droppedByRole: number;
  newEntries: number;
  updatedEntries: number;
  cacheOnlyEntries: number;
  revisions: number;
  orphanRevisions: number;
}

async function collectExistingRoleSlugs(dbEntries: readonly CachedPromptEntry[]): Promise<Set<string>> {
  const { listPromptsByRole } = await import('../db/prompt-db');
  const rolesTouched = new Set<PromptRole>();
  for (const e of dbEntries) if (isPromptRole(e.role)) rolesTouched.add(e.role);
  const existing = new Set<string>();
  for (const role of rolesTouched) {
    const res = await listPromptsByRole(role);
    if (res.ok && res.value) {
      for (const r of res.value) if (r.Slug) existing.add(role + ':' + r.Slug);
    }
  }
  return existing;
}

function tallyPreviewEntries(
  dbEntries: readonly CachedPromptEntry[],
  existing: ReadonlySet<string>,
): { added: number; updated: number; committedSlugs: Set<string> } {
  let updated = 0;
  let added = 0;
  const committedSlugs = new Set<string>();
  for (const e of dbEntries) {
    if (e.slug && isPromptRole(e.role)) {
      committedSlugs.add(e.slug);
      if (existing.has(e.role + ':' + e.slug)) updated++; else added++;
    } else {
      added++;
    }
  }
  return { added, updated, committedSlugs };
}

function tallyPreviewRevisions(
  revisions: readonly BundleRevisionRow[] | undefined,
  committedSlugs: ReadonlySet<string>,
): { revisions: number; orphan: number } {
  let revs = 0;
  let orphan = 0;
  if (revisions) {
    for (const r of revisions) {
      if (committedSlugs.has(r.Slug)) revs++; else orphan++;
    }
  }
  return { revisions: revs, orphan };
}

export async function previewPromptImport(
  importedPrompts: CachedPromptEntry[],
  options: { roleFilter?: PromptRole; revisions?: BundleRevisionRow[] } = {},
): Promise<PromptImportPreview> {
  const { kept, droppedCount } = applyRoleFilter(importedPrompts, options.roleFilter);
  const bridge = await import('./prompt-io-db-bridge');
  const { dbEntries, cacheEntries } = bridge.partitionByRole(kept);
  const existing = await collectExistingRoleSlugs(dbEntries);
  const { added, updated, committedSlugs } = tallyPreviewEntries(dbEntries, existing);
  const { revisions, orphan } = tallyPreviewRevisions(options.revisions, committedSlugs);
  return {
    totalInput: importedPrompts.length,
    droppedByRole: droppedCount,
    newEntries: added,
    updatedEntries: updated,
    cacheOnlyEntries: cacheEntries.length,
    revisions,
    orphanRevisions: orphan,
  };
}

/** Structural helper: re-export the bundle shape so callers can type-check
 * a parsed envelope without pulling `prompt-bundle-types` directly. */
export type { PromptsBundleV1 };


/**
 * Destructive: Clear all prompts from the cache.
 */
export async function performClearAllPrompts(): Promise<void> {
  const { writeJsonCopy, clearPromptCache } = await import('./prompt-cache');
  await writeJsonCopy([]);
  await clearPromptCache();

  const { invalidatePromptCache } = await import('./prompt-loader');
  invalidatePromptCache();
}
