/**
 * mini-zip.ts
 *
 * Zero-dependency ZIP writer that emits a STORED (uncompressed) archive
 * for small diagnostic payloads. Used by the Seed Diagnostics panel to
 * bundle the latest PROMPT_EDIT_E005 snapshots, related toast trace, and
 * a human-readable summary into a single downloadable file.
 *
 * Only supports text files stored uncompressed, which is sufficient for
 * a few KB of JSON/TXT and avoids pulling in a compression library.
 */

const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) !== 0 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) {
    const byte = bytes[index] ?? 0;
    const tableIndex = (crc ^ byte) & 0xff;
    crc = (crc >>> 8) ^ (CRC32_TABLE[tableIndex] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface MiniZipEntry {
  path: string;
  content: string;
}

interface CentralRecord {
  offset: number;
  crc: number;
  size: number;
  nameBytes: Uint8Array;
}

function writeUint32Le(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function writeUint16Le(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true);
}

function buildLocalHeader(record: CentralRecord): Uint8Array {
  const header = new Uint8Array(30 + record.nameBytes.length);
  const view = new DataView(header.buffer);
  writeUint32Le(view, 0, 0x04034b50);
  writeUint16Le(view, 4, 20);
  writeUint16Le(view, 6, 0);
  writeUint16Le(view, 8, 0);
  writeUint16Le(view, 10, 0);
  writeUint16Le(view, 12, 0);
  writeUint32Le(view, 14, record.crc);
  writeUint32Le(view, 18, record.size);
  writeUint32Le(view, 22, record.size);
  writeUint16Le(view, 26, record.nameBytes.length);
  writeUint16Le(view, 28, 0);
  header.set(record.nameBytes, 30);
  return header;
}

function buildCentralHeader(record: CentralRecord): Uint8Array {
  const header = new Uint8Array(46 + record.nameBytes.length);
  const view = new DataView(header.buffer);
  writeUint32Le(view, 0, 0x02014b50);
  writeUint16Le(view, 4, 20);
  writeUint16Le(view, 6, 20);
  writeUint16Le(view, 8, 0);
  writeUint16Le(view, 10, 0);
  writeUint16Le(view, 12, 0);
  writeUint16Le(view, 14, 0);
  writeUint32Le(view, 16, record.crc);
  writeUint32Le(view, 20, record.size);
  writeUint32Le(view, 24, record.size);
  writeUint16Le(view, 28, record.nameBytes.length);
  writeUint16Le(view, 30, 0);
  writeUint16Le(view, 32, 0);
  writeUint16Le(view, 34, 0);
  writeUint16Le(view, 36, 0);
  writeUint32Le(view, 38, 0);
  writeUint32Le(view, 42, record.offset);
  header.set(record.nameBytes, 46);
  return header;
}

function buildEndOfCentral(count: number, cdSize: number, cdOffset: number): Uint8Array {
  const buffer = new Uint8Array(22);
  const view = new DataView(buffer.buffer);
  writeUint32Le(view, 0, 0x06054b50);
  writeUint16Le(view, 4, 0);
  writeUint16Le(view, 6, 0);
  writeUint16Le(view, 8, count);
  writeUint16Le(view, 10, count);
  writeUint32Le(view, 12, cdSize);
  writeUint32Le(view, 16, cdOffset);
  writeUint16Le(view, 20, 0);
  return buffer;
}

/** Build a STORED ZIP archive as a Blob. All entries encoded as UTF-8. */
export function buildStoredZip(entries: MiniZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const records: CentralRecord[] = [];
  let offset = 0;
  for (const entry of entries) {
    const contentBytes = encoder.encode(entry.content);
    const nameBytes = encoder.encode(entry.path);
    const record: CentralRecord = {
      offset,
      crc: crc32(contentBytes),
      size: contentBytes.length,
      nameBytes,
    };
    const header = buildLocalHeader(record);
    chunks.push(header, contentBytes);
    offset += header.length + contentBytes.length;
    records.push(record);
  }
  const cdOffset = offset;
  let cdSize = 0;
  for (const record of records) {
    const central = buildCentralHeader(record);
    chunks.push(central);
    cdSize += central.length;
  }
  chunks.push(buildEndOfCentral(records.length, cdSize, cdOffset));
  return new Blob(chunks as BlobPart[], { type: 'application/zip' });
}
