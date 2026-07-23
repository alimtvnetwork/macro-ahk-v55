/**
 * Prompt slug utilities (plan 12 step 21).
 *
 * Extracted from `prompt-io-zip.ts` and `prompt-import-modal.ts` so that
 * the ZIP exporter, SQLite exporter, ZIP reader, SQLite reader, and the
 * import modal all agree on one canonical slug shape. Previously the
 * `sanitizeSlug` file-name sanitizer lived inside the ZIP writer and the
 * import-modal owned its own `slugKey` / `makeUniqueSlug` helpers; a
 * regression in one path silently disagreed with the other.
 *
 * All three helpers are pure and side-effect free. Log any failure at
 * the call site; nothing here throws or swallows.
 */

import type { PromptEntry } from '../types/ui-types';

/* ------------------------------------------------------------------ */
/*  File-name sanitizer                                                */
/* ------------------------------------------------------------------ */

const UNSAFE_FILE_CHARS = /[^a-z0-9\-_]/gi;

/**
 * Lowercase + strip file-system-hostile characters. Falls back to
 * `entry-<index>` when the input contains no safe characters at all
 * (e.g. an all-emoji name).
 */
export function sanitizeSlug(rawSlug: string, fallbackIndex: number): string {
  const trimmed = rawSlug.trim().toLowerCase();
  const safe = trimmed
    .replace(UNSAFE_FILE_CHARS, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const hasSafeChars = safe.length > 0;
  return hasSafeChars ? safe : `entry-${fallbackIndex}`;
}

/* ------------------------------------------------------------------ */
/*  Cache key derivation                                               */
/* ------------------------------------------------------------------ */

/**
 * Lowercase key used to merge incoming import rows against the existing
 * cache. Uses `slug` when present, otherwise `name`. Case-insensitive
 * so `My-Prompt` and `my-prompt` collide as expected.
 */
export function slugKey(entry: PromptEntry): string {
  const source = entry.slug ?? entry.name;
  return source.toLowerCase();
}

/* ------------------------------------------------------------------ */
/*  Rename disambiguator (step 15 "rename" action)                     */
/* ------------------------------------------------------------------ */

/**
 * Append `-imported`, `-imported-2`, `-imported-3`, ... until the
 * candidate does not collide with any lowercase key in `taken`.
 * Case-insensitive so it matches `slugKey`.
 */
export function makeUniqueSlug(base: string, taken: Set<string>): string {
  const suffix = '-imported';
  let candidate = base + suffix;
  let counter = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = base + suffix + '-' + counter;
    counter += 1;
  }
  return candidate;
}
