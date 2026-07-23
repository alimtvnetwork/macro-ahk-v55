/**
 * Bundle format detector (plan 12 step 12).
 *
 * Sniffs magic bytes so drag-and-drop (step 13) and the file-picker
 * dispatcher can trust the content, not the filename. Never swallows:
 * unknown magic throws with a hex dump of the first 16 bytes so SS-06
 * can render "unknown magic 0x??…".
 *
 * Magic bytes:
 *   JSON    -> first non-whitespace char is `{` or `[`
 *   ZIP     -> `50 4B 03 04` (PK\x03\x04)
 *   SQLite  -> `53 51 4C 69 74 65 20 66 6F 72 6D 61 74 20 33 00`
 *              ("SQLite format 3\0")
 */

import type { PromptsBundleFormat } from './prompt-bundle-types';
import { throwDiagnostic } from '../errors/diagnostic-error';

const ZIP_MAGIC: readonly number[] = [0x50, 0x4b, 0x03, 0x04];
const SQLITE_MAGIC: readonly number[] = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
  0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
];

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

function isJsonPrefix(bytes: Uint8Array): boolean {
  for (let i = 0; i < Math.min(bytes.length, 64); i++) {
    const b = bytes[i];
    const isWhitespace = b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d || b === 0xef || b === 0xbb || b === 0xbf;
    if (isWhitespace) continue;
    return b === 0x7b || b === 0x5b; // `{` or `[`
  }
  return false;
}

function hexDump(bytes: Uint8Array, count: number): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, count));
  return Array.from(slice, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export interface FormatDetection {
  format: PromptsBundleFormat;
}

/**
 * Detect the bundle format from the file's leading bytes.
 * Throws with a hex dump if no format matches. Never returns null.
 */
export function detectBundleFormat(bytes: Uint8Array): FormatDetection {
  if (startsWith(bytes, SQLITE_MAGIC)) return { format: 'sqlite' };
  if (startsWith(bytes, ZIP_MAGIC)) return { format: 'zip' };
  if (isJsonPrefix(bytes)) return { format: 'json' };
  throwDiagnostic('PROMPT_IO_FORMAT_E001', { byteHexDump: hexDump(bytes, 16) });
}
