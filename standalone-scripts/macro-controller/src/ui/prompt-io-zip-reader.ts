/**
 * Prompts ZIP importer (plan 12 step 10).
 *
 * Reads bundles produced by `prompt-io-zip.ts` (store-only PKZIP, no
 * deflate). Method-0 only: a compressed ZIP throws a clear error so
 * SS-06 (step 19) can render it verbatim — never swallowed, never
 * silently skipped.
 *
 * Flow:
 *   1. Locate End-of-Central-Directory (EOCD).
 *   2. Walk the central directory to build a filename -> bytes map.
 *   3. Read `manifest.json` -> envelope.
 *   4. For each entry the manifest lists, pair its `.md` body back into
 *      `entry.text` and hand the reconstructed bundle to
 *      `validatePromptsBundle()`.
 */

import type { PromptEntry } from '../types/ui-types';
import type { BundleValidationResult, PromptsBundleV1 } from './prompt-bundle-types';
import { validatePromptsBundle } from './prompt-bundle-types';
import { sanitizeSlug } from './prompt-slug-utils';
import { throwDiagnostic } from '../errors/diagnostic-error';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/* ------------------------------------------------------------------ */
/*  Low-level ZIP reader (store method only)                           */
/* ------------------------------------------------------------------ */

interface ZipFileMap {
  files: Map<string, Uint8Array>;
}

function readUint16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function locateEocd(view: DataView): number {
  const max = view.byteLength;
  const scanFrom = Math.max(0, max - 65557);
  for (let i = max - 22; i >= scanFrom; i--) {
    if (readUint32LE(view, i) === SIG_EOCD) return i;
  }
  throwDiagnostic('PROMPT_IO_ZIP_E001', { byteLength: max });
}

interface CentralEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

function readCentralEntry(view: DataView, bytes: Uint8Array, offset: number): { entry: CentralEntry; next: number } {
  const sig = readUint32LE(view, offset);
  if (sig !== SIG_CENTRAL) throwDiagnostic('PROMPT_IO_ZIP_E002', { offset, signatureHex: sig.toString(16).padStart(8, '0') });
  const method = readUint16LE(view, offset + 10);
  const compressedSize = readUint32LE(view, offset + 20);
  const uncompressedSize = readUint32LE(view, offset + 24);
  const nameLen = readUint16LE(view, offset + 28);
  const extraLen = readUint16LE(view, offset + 30);
  const commentLen = readUint16LE(view, offset + 32);
  const localOffset = readUint32LE(view, offset + 42);
  const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLen);
  const name = new TextDecoder('utf-8').decode(nameBytes);
  const next = offset + 46 + nameLen + extraLen + commentLen;
  return { entry: { name, method, compressedSize, uncompressedSize, localOffset }, next };
}

function extractStoredPayload(view: DataView, bytes: Uint8Array, entry: CentralEntry): Uint8Array {
  const sig = readUint32LE(view, entry.localOffset);
  if (sig !== SIG_LOCAL) throwDiagnostic('PROMPT_IO_ZIP_E003', { entryName: entry.name, offset: entry.localOffset });
  if (entry.method !== 0) {
    throwDiagnostic('PROMPT_IO_ZIP_E004', { entryName: entry.name, compressionMethod: entry.method });
  }
  const nameLen = readUint16LE(view, entry.localOffset + 26);
  const extraLen = readUint16LE(view, entry.localOffset + 28);
  const dataStart = entry.localOffset + 30 + nameLen + extraLen;
  return bytes.subarray(dataStart, dataStart + entry.compressedSize);
}

function readZipFileMap(bytes: Uint8Array): ZipFileMap {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = locateEocd(view);
  const entryCount = readUint16LE(view, eocdOffset + 10);
  const centralOffset = readUint32LE(view, eocdOffset + 16);
  const files = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    const { entry, next } = readCentralEntry(view, bytes, cursor);
    files.set(entry.name, extractStoredPayload(view, bytes, entry));
    cursor = next;
  }
  return { files };
}

/* ------------------------------------------------------------------ */
/*  Manifest + entry reconstruction                                    */
/* ------------------------------------------------------------------ */

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function parseManifest(map: ZipFileMap): PromptsBundleV1 {
  const manifestBytes = map.files.get('manifest.json');
  if (!manifestBytes) throwDiagnostic('PROMPT_IO_ZIP_E005', { entryCount: map.files.size });
  const raw = JSON.parse(decodeUtf8(manifestBytes)) as unknown;
  // Manifest entries have their bodies stripped: inject empty text
  // placeholders so validatePromptsBundle passes, then we rehydrate.
  if (raw && typeof raw === 'object' && Array.isArray((raw as { entries?: unknown[] }).entries)) {
    (raw as { entries: Record<string, unknown>[] }).entries.forEach((e) => {
      if (typeof e.text !== 'string') e.text = '';
    });
  }
  const result: BundleValidationResult = validatePromptsBundle(raw);
  if (!result.isValid || !result.bundle) {
    throwDiagnostic('PROMPT_IO_ZIP_E006', { errorList: result.errors.join('; ') });
  }
  return result.bundle;
}

function rehydrateBody(entry: PromptEntry, index: number, map: ZipFileMap): PromptEntry {
  const slugSource = entry.slug ?? entry.name;
  const slug = sanitizeSlug(slugSource, index + 1);
  const bodyBytes = map.files.get(`entries/${slug}.md`);
  const hasBody = bodyBytes !== undefined;
  if (!hasBody) throwDiagnostic('PROMPT_IO_ZIP_E007', { slug, promptName: entry.name });
  return { ...entry, text: decodeUtf8(bodyBytes as Uint8Array) };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface ZipImportResult {
  bundle: PromptsBundleV1;
  fileCount: number;
}

/**
 * Parse a prompts ZIP bundle. Throws with file+function context on any
 * failure so SS-06 can render it. Never swallows.
 */
export function parsePromptsBundleZip(bytes: Uint8Array): ZipImportResult {
  const map = readZipFileMap(bytes);
  const shell = parseManifest(map);
  const entries = shell.entries.map((entry, i) => rehydrateBody(entry, i, map));
  const bundle: PromptsBundleV1 = { ...shell, entries, entryCount: entries.length };
  return { bundle, fileCount: map.files.size };
}
