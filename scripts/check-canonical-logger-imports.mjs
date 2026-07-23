#!/usr/bin/env node
/**
 * check-canonical-logger-imports.mjs
 *
 * Enforces the single canonical logging entry point:
 *   import { ... } from '<relative>/logger';
 *
 * Forbids direct imports of './logging' (or any `../logging` chain)
 * from anywhere under standalone-scripts/macro-controller/src except
 * for two allow-listed files:
 *   - src/logger.ts   (the barrel, re-exports the source)
 *   - src/logging.ts  (the implementation module itself)
 *
 * Prevents recurrence of TS2307 filename-drift regressions.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = 'standalone-scripts/macro-controller/src';
const ALLOW = new Set([
  join(ROOT, 'logger.ts'),
  join(ROOT, 'logging.ts'),
]);
const PATTERN = /from\s+['"]((?:\.\.\/|\.\/)+)logging['"]/g;

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];
for (const file of walk(ROOT)) {
  const normalized = file.split(sep).join('/');
  const allowNormalized = [...ALLOW].map((p) => p.split(sep).join('/'));
  if (allowNormalized.includes(normalized)) continue;
  const src = readFileSync(file, 'utf8');
  const matches = [...src.matchAll(PATTERN)];
  if (matches.length > 0) {
    offenders.push({ file: relative(process.cwd(), file), count: matches.length });
  }
}

if (offenders.length > 0) {
  console.error('[check-canonical-logger-imports] FAIL: forbidden `./logging` imports found.');
  console.error('Use `./logger` (the canonical barrel) instead. See src/logger.ts header.');
  for (const o of offenders) {
    console.error(`  - ${o.file} (${o.count} match${o.count === 1 ? '' : 'es'})`);
  }
  process.exit(1);
}

console.log('[check-canonical-logger-imports] OK: all logging imports go through ./logger');
