/**
 * Prompts ZIP exporter (plan 12 step 7 / SS-02).
 *
 * Store-only ZIP writer: no compression, no deflate table, no external
 * dependency. Produces a bundle a human can unzip and read.
 *
 * Layout produced (SS-02):
 *   /manifest.json         -> PromptsBundleV1 envelope minus body text
 *   /entries/<slug>.md     -> the prompt body (raw text)
 *   /entries/<slug>.meta.json -> per-entry metadata block
 *
 * Errors are surfaced, never swallowed. The caller is responsible for
 * turning the returned Blob into a download and for logging failures.
 */

import type { PromptEntry } from '../types/ui-types';
import type { PromptsBundleV1 } from './prompt-bundle-types';
import { buildPromptsBundle } from './prompt-bundle-types';
import { sanitizeSlug } from './prompt-slug-utils';

/* ------------------------------------------------------------------ */
/*  Filename sanitizer (canonical home is prompt-slug-utils, step 21)  */
/*  Re-exported here so existing importers keep working.               */
/* ------------------------------------------------------------------ */

export { sanitizeSlug };

/* ------------------------------------------------------------------ */
/*  CRC32 (IEEE polynomial 0xEDB88320) — ZIP spec requires per-entry   */
/* ------------------------------------------------------------------ */

let CRC_TABLE: Uint32Array | null = null;

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) CRC_TABLE = buildCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ */
/*  Store-only ZIP writer                                              */
/* ------------------------------------------------------------------ */

interface ZipMember {
  path: string;
  bytes: Uint8Array;
  crc: number;
  offset: number;
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function writeUint16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function buildLocalHeader(member: ZipMember): Uint8Array {
  const nameBytes = encodeUtf8(member.path);
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  writeUint32LE(view, 0, 0x04034b50);      // local file header signature
  writeUint16LE(view, 4, 20);              // version needed
  writeUint16LE(view, 6, 0x0800);          // general purpose (UTF-8 name)
  writeUint16LE(view, 8, 0);               // method: store
  writeUint16LE(view, 10, 0);              // mod time
  writeUint16LE(view, 12, 0);              // mod date
  writeUint32LE(view, 14, member.crc);
  writeUint32LE(view, 18, member.bytes.length);
  writeUint32LE(view, 22, member.bytes.length);
  writeUint16LE(view, 26, nameBytes.length);
  writeUint16LE(view, 28, 0);              // extra field length
  header.set(nameBytes, 30);
  return header;
}

function buildCentralEntry(member: ZipMember): Uint8Array {
  const nameBytes = encodeUtf8(member.path);
  const entry = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(entry.buffer);
  writeUint32LE(view, 0, 0x02014b50);      // central directory signature
  writeUint16LE(view, 4, 20);              // version made by
  writeUint16LE(view, 6, 20);              // version needed
  writeUint16LE(view, 8, 0x0800);
  writeUint16LE(view, 10, 0);              // method: store
  writeUint16LE(view, 12, 0);
  writeUint16LE(view, 14, 0);
  writeUint32LE(view, 16, member.crc);
  writeUint32LE(view, 20, member.bytes.length);
  writeUint32LE(view, 24, member.bytes.length);
  writeUint16LE(view, 28, nameBytes.length);
  writeUint16LE(view, 30, 0);
  writeUint16LE(view, 32, 0);              // file comment length
  writeUint16LE(view, 34, 0);              // disk number start
  writeUint16LE(view, 36, 0);              // internal attrs
  writeUint32LE(view, 38, 0);              // external attrs
  writeUint32LE(view, 42, member.offset);
  entry.set(nameBytes, 46);
  return entry;
}

function buildEocd(centralOffset: number, centralSize: number, count: number): Uint8Array {
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  writeUint32LE(view, 0, 0x06054b50);
  writeUint16LE(view, 4, 0);               // disk number
  writeUint16LE(view, 6, 0);               // disk with central directory
  writeUint16LE(view, 8, count);
  writeUint16LE(view, 10, count);
  writeUint32LE(view, 12, centralSize);
  writeUint32LE(view, 16, centralOffset);
  writeUint16LE(view, 20, 0);              // comment length
  return eocd;
}

function assembleZip(members: ZipMember[]): Blob {
  const parts: Uint8Array[] = [];
  members.forEach((m) => {
    parts.push(buildLocalHeader(m));
    parts.push(m.bytes);
  });
  const centralStart = parts.reduce((sum, p) => sum + p.length, 0);
  const centralParts: Uint8Array[] = members.map(buildCentralEntry);
  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  centralParts.forEach((p) => parts.push(p));
  parts.push(buildEocd(centralStart, centralSize, members.length));
  return new Blob(parts as BlobPart[], { type: 'application/zip' });
}

/* ------------------------------------------------------------------ */
/*  Entry serialization                                                */
/* ------------------------------------------------------------------ */

interface StagedEntry {
  slug: string;
  bodyMd: Uint8Array;
  metaJson: Uint8Array;
}

function stripBody(entry: PromptEntry): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...entry };
  delete clone.text;
  return clone;
}

function stageEntries(entries: PromptEntry[]): StagedEntry[] {
  return entries.map((entry, index) => {
    const slugSource = entry.slug ?? entry.name;
    const slug = sanitizeSlug(slugSource, index + 1);
    return {
      slug,
      bodyMd: encodeUtf8(entry.text),
      metaJson: encodeUtf8(JSON.stringify(stripBody(entry), null, 2)),
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface ZipExportResult {
  blob: Blob;
  bundle: PromptsBundleV1;
  fileCount: number;
}

/**
 * Build the store-only ZIP for the given prompt entries. Returns the
 * Blob plus the envelope that was written into `/manifest.json` so
 * callers can log a stable audit line.
 */
export function buildPromptsZip(entries: PromptEntry[], exporterVersion: string): ZipExportResult {
  const bundle = buildPromptsBundle(entries, exporterVersion, { format: 'zip' });
  const staged = stageEntries(bundle.entries);
  const manifestBundle: PromptsBundleV1 = { ...bundle, entries: bundle.entries.map(stripBody) as unknown as PromptEntry[] };
  const manifestBytes = encodeUtf8(JSON.stringify(manifestBundle, null, 2));

  const members: ZipMember[] = [];
  let cursor = 0;

  const pushMember = (path: string, bytes: Uint8Array): void => {
    const member: ZipMember = { path, bytes, crc: crc32(bytes), offset: cursor };
    const header = buildLocalHeader(member);
    cursor += header.length + bytes.length;
    members.push(member);
  };

  pushMember('manifest.json', manifestBytes);
  staged.forEach((s) => {
    pushMember(`entries/${s.slug}.md`, s.bodyMd);
    pushMember(`entries/${s.slug}.meta.json`, s.metaJson);
  });

  return { blob: assembleZip(members), bundle, fileCount: members.length };
}
