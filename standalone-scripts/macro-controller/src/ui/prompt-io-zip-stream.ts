/**
 * Streaming prompts ZIP writer (plan 12 step 22).
 *
 * The synchronous `buildPromptsZip` in `prompt-io-zip.ts` materialises
 * every entry in memory as one `Uint8Array` before wrapping it in a
 * Blob. That is fine for a hundred prompts, but users with thousands of
 * long-form prompts hit `RangeError: Invalid array buffer length` on
 * mobile Chrome long before the download starts.
 *
 * This module emits a `ReadableStream<Uint8Array>` that yields ZIP bytes
 * as each staged entry is encoded, so the browser can pipe the stream
 * straight to disk (via `Response.body` -> `<a download>` on the Blob
 * built from the stream, or `showSaveFilePicker().createWritable()` on
 * platforms that expose it) without ever holding the full archive in a
 * single buffer.
 *
 * ZIP layout is identical to the sync writer (store-only, no deflate),
 * so bytes produced here are byte-identical to `buildPromptsZip` for
 * the same input. Central directory is buffered in memory (small: 46B
 * + name per entry) then emitted at the end, followed by the EOCD.
 *
 * All error paths surface via the stream's `error()` channel; nothing
 * is swallowed. Callers should attach a `.catch()` on the consuming
 * Promise (e.g. the response used to build the Blob) and log via the
 * namespace logger.
 */

import type { PromptEntry } from '../types/ui-types';
import type { PromptsBundleV1 } from './prompt-bundle-types';
import { buildPromptsBundle } from './prompt-bundle-types';
import { sanitizeSlug } from './prompt-slug-utils';

/* ------------------------------------------------------------------ */
/*  CRC32 (same polynomial as prompt-io-zip.ts)                        */
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
/*  Low-level record builders                                          */
/* ------------------------------------------------------------------ */

interface CentralRecord {
  path: string;
  crc: number;
  size: number;
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

function buildLocalHeader(path: string, crc: number, size: number): Uint8Array {
  const nameBytes = encodeUtf8(path);
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  writeUint32LE(view, 0, 0x04034b50);
  writeUint16LE(view, 4, 20);
  writeUint16LE(view, 6, 0x0800);
  writeUint16LE(view, 8, 0);
  writeUint16LE(view, 10, 0);
  writeUint16LE(view, 12, 0);
  writeUint32LE(view, 14, crc);
  writeUint32LE(view, 18, size);
  writeUint32LE(view, 22, size);
  writeUint16LE(view, 26, nameBytes.length);
  writeUint16LE(view, 28, 0);
  header.set(nameBytes, 30);
  return header;
}

function buildCentralEntry(record: CentralRecord): Uint8Array {
  const nameBytes = encodeUtf8(record.path);
  const entry = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(entry.buffer);
  writeUint32LE(view, 0, 0x02014b50);
  writeUint16LE(view, 4, 20);
  writeUint16LE(view, 6, 20);
  writeUint16LE(view, 8, 0x0800);
  writeUint16LE(view, 10, 0);
  writeUint16LE(view, 12, 0);
  writeUint16LE(view, 14, 0);
  writeUint32LE(view, 16, record.crc);
  writeUint32LE(view, 20, record.size);
  writeUint32LE(view, 24, record.size);
  writeUint16LE(view, 28, nameBytes.length);
  writeUint16LE(view, 30, 0);
  writeUint16LE(view, 32, 0);
  writeUint16LE(view, 34, 0);
  writeUint16LE(view, 36, 0);
  writeUint32LE(view, 38, 0);
  writeUint32LE(view, 42, record.offset);
  entry.set(nameBytes, 46);
  return entry;
}

function buildEocd(centralOffset: number, centralSize: number, count: number): Uint8Array {
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  writeUint32LE(view, 0, 0x06054b50);
  writeUint16LE(view, 4, 0);
  writeUint16LE(view, 6, 0);
  writeUint16LE(view, 8, count);
  writeUint16LE(view, 10, count);
  writeUint32LE(view, 12, centralSize);
  writeUint32LE(view, 16, centralOffset);
  writeUint16LE(view, 20, 0);
  return eocd;
}

/* ------------------------------------------------------------------ */
/*  Public streaming API                                               */
/* ------------------------------------------------------------------ */

export interface StreamingZipInfo {
  bundle: PromptsBundleV1;
  fileCount: number;
}

function stripBody(entry: PromptEntry): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...entry };
  delete clone.text;
  return clone;
}

/**
 * Build a `ReadableStream<Uint8Array>` yielding a store-only ZIP for
 * the given prompt entries. Also returns the bundle envelope (same
 * shape written into `/manifest.json`) and the total file count so the
 * caller can emit a stable audit log line the moment the stream is
 * created, before consumption completes.
 *
 * Consumer example:
 *
 *   const { stream, info } = buildPromptsZipStream(entries, '4.43.0');
 *   const blob = await new Response(stream).blob();
 *   log(`[PromptsExport] code=ZIP_STREAM_READY files=${info.fileCount}`);
 */
export function buildPromptsZipStream(
  entries: PromptEntry[],
  exporterVersion: string,
): { stream: ReadableStream<Uint8Array>; info: StreamingZipInfo } {
  const bundle = buildPromptsBundle(entries, exporterVersion, { format: 'zip' });
  const manifestBundle: PromptsBundleV1 = {
    ...bundle,
    entries: bundle.entries.map(stripBody) as unknown as PromptEntry[],
  };
  const manifestBytes = encodeUtf8(JSON.stringify(manifestBundle, null, 2));
  const preparedEntries = bundle.entries.map((entry, index) => {
    const slugSource = entry.slug ?? entry.name;
    const slug = sanitizeSlug(slugSource, index + 1);
    return {
      bodyPath: `entries/${slug}.md`,
      body: encodeUtf8(entry.text),
      metaPath: `entries/${slug}.meta.json`,
      meta: encodeUtf8(JSON.stringify(stripBody(entry), null, 2)),
    };
  });

  const fileCount = 1 + preparedEntries.length * 2;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        const central: CentralRecord[] = [];
        let cursor = 0;

        const emit = (path: string, bytes: Uint8Array): void => {
          const crc = crc32(bytes);
          const header = buildLocalHeader(path, crc, bytes.length);
          controller.enqueue(header);
          controller.enqueue(bytes);
          central.push({ path, crc, size: bytes.length, offset: cursor });
          cursor += header.length + bytes.length;
        };

        emit('manifest.json', manifestBytes);
        preparedEntries.forEach((p) => {
          emit(p.bodyPath, p.body);
          emit(p.metaPath, p.meta);
        });

        const centralStart = cursor;
        let centralSize = 0;
        central.forEach((rec) => {
          const bytes = buildCentralEntry(rec);
          controller.enqueue(bytes);
          centralSize += bytes.length;
        });
        controller.enqueue(buildEocd(centralStart, centralSize, central.length));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return { stream, info: { bundle, fileCount } };
}
