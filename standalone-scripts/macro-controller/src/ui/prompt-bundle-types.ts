/**
 * Prompts Export/Import bundle envelope (plan 12 step 4).
 *
 * Runtime mirror of `schemas/prompts-export-bundle.schema.json`. The envelope
 * is the single source consumed by all three exporters (JSON / ZIP / SQLite)
 * and produced by all three importers, so formats stay in sync.
 *
 * The `PromptEntry` fields intentionally match
 * `standalone-scripts/macro-controller/src/types/ui-types.ts` L47-70 so
 * dynamic-expansion prompts (`Next ${N}`, `Plan ${N}`) round-trip without
 * loss — the exact gap identified in
 * `.lovable/plans/subtasks/12-prompts-import-export-menu/notes-01-call-graph.md`.
 */

import type { PromptEntry } from '../types/ui-types';
import { isPromptRole, type PromptRole } from '../types/prompt-role';

/** Envelope schema version. Bump only for breaking changes. */
export const PROMPTS_BUNDLE_SCHEMA_VERSION = 1 as const;

/** Serialization format the entries travelled through. */
export type PromptsBundleFormat = 'json' | 'zip' | 'sqlite';

/**
 * Revision history rows carried inside a bundle when the exporter is
 * invoked with `includeRevisions: true` (v4.190.0). Field names mirror
 * `ImportedRevisionInput` in `db/prompt-revision-db.ts` so an importer
 * can `insertImportedRevisions(slug, rows)` without reshaping.
 *
 * `PromptId` is intentionally omitted here: it is meaningless off-device
 * (the row Id in the source DB does not exist in the target). Importers
 * write `PromptId = 0` to mark rows as "off-device archive".
 */
export interface BundleRevisionRow {
  Slug: string;
  Name: string;
  Body: string;
  Role: PromptRole;
  ReplaceKey: string;
  ReplaceValues: string;
  CreatedAt: number;
  Reason: string;
}

/**
 * User-facing export bundle. Every exporter builds one of these first,
 * then serializes to its target format.
 */
export interface PromptsBundleV1 {
  /** UUIDv4 for this bundle. Lets importers detect re-imports. */
  id: string;
  /** Envelope schema version. Always `1` for this build. */
  schemaVersion: typeof PROMPTS_BUNDLE_SCHEMA_VERSION;
  /** UTC ISO-8601 timestamp. */
  exportedAt: string;
  /** `EXTENSION_VERSION` at export time (semver). */
  exporterVersion: string;
  /** `entries.length`. Importers cross-check. */
  entryCount: number;
  /** Serialization the entries travelled through. Optional for inline JSON. */
  format?: PromptsBundleFormat;
  /** Prompt entries in export order. `excludeFromExport:true` items are pre-filtered. */
  entries: PromptEntry[];
  /**
   * Optional revision-history payload (v4.190.0 opt-in). When present, each
   * row's `Slug` MUST match one of `entries[*].slug`. Absence is the default
   * and matches the pre-v4.190.0 shape exactly (byte-for-byte for bundles
   * without revisions).
   */
  revisions?: BundleRevisionRow[];
  /**
   * Optional user-visible display order (v4.383.0). Array of prompt slugs
   * in the exact sequence the user sees in the dropdown, including any
   * drag-reorder customizations. Importers restore it into
   * `localStorage['marco.promptOrder.v1']`. Legacy bundles without this
   * field fall back to `DEFAULT_PROMPT_ORDER`.
   */
  promptOrder?: string[];
}

/** Result of validating an unknown value against the envelope. */
export interface BundleValidationResult {
  isValid: boolean;
  bundle: PromptsBundleV1 | null;
  errors: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** True when the value is a plain object (rejects null / arrays). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when the value is a non-empty string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Copy known string fields from raw onto entry when present and typed correctly. */
function assignStringFields(entry: PromptEntry, raw: Record<string, unknown>): void {
  const keys: (keyof PromptEntry)[] = [
    'id', 'slug', 'category', 'slugTemplate', 'parentTitle', 'parentSlug', 'variantValue', 'replaceKey',
  ];
  for (const key of keys) {
    if (typeof raw[key as string] === 'string') {
      (entry as unknown as Record<string, unknown>)[key as string] = raw[key as string];

    }
  }
}

/** Copy known boolean fields from raw onto entry when present and typed correctly. */
function assignBooleanFields(entry: PromptEntry, raw: Record<string, unknown>): void {
  const keys: (keyof PromptEntry)[] = ['isFavorite', 'isDefault', 'excludeFromExport', 'isDynamic'];
  for (const key of keys) {
    if (typeof raw[key as string] === 'boolean') {
      (entry as unknown as Record<string, unknown>)[key as string] = raw[key as string];
    }
  }
}

/** Coerce a raw record into a PromptEntry, dropping unknown keys. */
function coercePromptEntry(raw: Record<string, unknown>): PromptEntry | null {
  const hasName = isNonEmptyString(raw['name']);
  const hasText = typeof raw['text'] === 'string';
  if (!hasName || !hasText) return null;
  const entry: PromptEntry = { name: raw['name'] as string, text: raw['text'] as string };
  assignStringFields(entry, raw);
  assignBooleanFields(entry, raw);
  const rawTags = raw['tags'];
  if (Array.isArray(rawTags)) entry.tags = rawTags.filter((t): t is string => typeof t === 'string');
  const rawReplaceValues = raw['replaceValues'];
  if (Array.isArray(rawReplaceValues)) {
    entry.replaceValues = rawReplaceValues.filter((v): v is string => typeof v === 'string');
  }
  const rawRole = raw['role'];
  if (isPromptRole(rawRole)) entry.role = rawRole;
  return entry;
}



/** Validate the top-level envelope fields (id, versions, timestamps). */
function validateEnvelopeFields(value: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!UUID_RE.test(String(value['id']))) errors.push('Missing or malformed id (expected UUIDv4)');
  if (value['schemaVersion'] !== PROMPTS_BUNDLE_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${PROMPTS_BUNDLE_SCHEMA_VERSION}`);
  if (typeof value['exportedAt'] !== 'string') errors.push('exportedAt must be an ISO-8601 string');
  const exporterVersion = value['exporterVersion'];
  if (typeof exporterVersion !== 'string' || !SEMVER_RE.test(exporterVersion)) {
    errors.push('exporterVersion must be semver (e.g. 4.34.0)');
  }
  return errors;
}

/** Coerce a raw entries array into typed PromptEntry list, collecting errors. */
function validateEntries(rawEntries: unknown[]): { entries: PromptEntry[]; errors: string[] } {
  const entries: PromptEntry[] = [];
  const errors: string[] = [];
  rawEntries.forEach((raw, index) => {
    if (!isPlainObject(raw)) {
      errors.push(`entries[${index}] is not an object`);
      return;
    }
    const entry = coercePromptEntry(raw);
    if (!entry) {
      errors.push(`entries[${index}] missing required name/text`);
      return;
    }
    entries.push(entry);
  });
  return { entries, errors };
}

/** Validate a parsed JSON value against the envelope contract. */
export function validatePromptsBundle(value: unknown): BundleValidationResult {
  if (!isPlainObject(value)) {
    return { isValid: false, bundle: null, errors: ['Bundle root is not an object'] };
  }
  const errors = validateEnvelopeFields(value);
  const rawEntries = value['entries'];
  if (!Array.isArray(rawEntries)) {
    errors.push('entries must be an array');
    return { isValid: false, bundle: null, errors };
  }
  const { entries, errors: entryErrors } = validateEntries(rawEntries);
  errors.push(...entryErrors);
  const rawEntryCount = value['entryCount'];
  if (rawEntryCount !== entries.length) {
    errors.push(`entryCount (${String(rawEntryCount)}) != entries.length (${entries.length})`);
  }
  if (errors.length > 0) return { isValid: false, bundle: null, errors };
  const bundle: PromptsBundleV1 = {
    id: value['id'] as string,
    schemaVersion: 1,
    exportedAt: value['exportedAt'] as string,
    exporterVersion: value['exporterVersion'] as string,
    entryCount: entries.length,
    entries,
  };
  const rawFormat = value['format'];
  if (rawFormat === 'json' || rawFormat === 'zip' || rawFormat === 'sqlite') {
    bundle.format = rawFormat;
  }
  const rawRevisions = value['revisions'];
  if (Array.isArray(rawRevisions)) {
    const validRevs = coerceBundleRevisions(rawRevisions);
    if (validRevs.length > 0) bundle.revisions = validRevs;
  }
  const rawOrder = value['promptOrder'];
  if (Array.isArray(rawOrder)) {
    const orderStrings = rawOrder.filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (orderStrings.length > 0) bundle.promptOrder = orderStrings;
  }
  return { isValid: true, bundle, errors: [] };
}


/** Coerce an unknown `revisions` array into typed `BundleRevisionRow[]`.
 * Silently drops malformed rows: revisions are optional metadata, so a
 * bad row must not fail the whole import. Malformed rows still get
 * logged by the importer at commit time. */
function coerceBundleRevisionRow(item: Record<string, unknown>): BundleRevisionRow | null {
  const slug = typeof item['Slug'] === 'string' ? item['Slug'] : '';
  const name = typeof item['Name'] === 'string' ? item['Name'] : '';
  const body = typeof item['Body'] === 'string' ? item['Body'] : '';
  const role = item['Role'];
  const rk = typeof item['ReplaceKey'] === 'string' ? item['ReplaceKey'] : '';
  const rv = typeof item['ReplaceValues'] === 'string' ? item['ReplaceValues'] : '[]';
  const createdAtRaw = item['CreatedAt'];
  const createdAt = typeof createdAtRaw === 'number' ? createdAtRaw : Number(createdAtRaw);
  const reason = typeof item['Reason'] === 'string' ? item['Reason'] : 'import';
  if (!slug || !name || !isPromptRole(role)) return null;
  if (!Number.isFinite(createdAt)) return null;
  return { Slug: slug, Name: name, Body: body, Role: role, ReplaceKey: rk, ReplaceValues: rv, CreatedAt: createdAt, Reason: reason };
}

function coerceBundleRevisions(raw: unknown[]): BundleRevisionRow[] {
  const out: BundleRevisionRow[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const row = coerceBundleRevisionRow(item);
    if (row) out.push(row);
  }
  return out;
}


/** Generate a UUIDv4. Prefers `crypto.randomUUID`, falls back to a hand-rolled v4. */
function newBundleId(): string {
  const hasNativeUuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
  if (hasNativeUuid) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Build a bundle envelope from a raw PromptEntry list. Filters
 * `excludeFromExport:true` entries by default; pass `{ includeExcluded: true }`
 * to keep them (used by the round-trip test fixture). Pass
 * `{ revisions: [...] }` to attach revision history (v4.190.0 opt-in).
 */
export function buildPromptsBundle(
  entries: PromptEntry[],
  exporterVersion: string,
  options: {
    format?: PromptsBundleFormat;
    includeExcluded?: boolean;
    revisions?: BundleRevisionRow[];
    promptOrder?: string[];
  } = {},
): PromptsBundleV1 {
  const filtered = options.includeExcluded ? entries : entries.filter((e) => !e.excludeFromExport);
  const bundle: PromptsBundleV1 = {
    id: newBundleId(),
    schemaVersion: PROMPTS_BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    exporterVersion,
    entryCount: filtered.length,
    entries: filtered,
  };
  if (options.format) bundle.format = options.format;
  if (options.revisions && options.revisions.length > 0) {
    // Filter to revisions whose Slug matches an entry in the bundle. This
    // preserves the invariant that revisions never reference dropped rows.
    const slugSet = new Set(filtered.map((e) => e.slug).filter((s): s is string => typeof s === 'string' && s.length > 0));
    const kept = options.revisions.filter((r) => slugSet.has(r.Slug));
    if (kept.length > 0) bundle.revisions = kept;
  }
  if (options.promptOrder && options.promptOrder.length > 0) {
    bundle.promptOrder = options.promptOrder.slice();
  }
  return bundle;
}
