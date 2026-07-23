#!/usr/bin/env node
/**
 * check-unknown-usage.mjs - Plan-17 step 29 (unknown/as-unknown-as ratchet).
 *
 * Counts occurrences of the `unknown` type and `as unknown as` double casts
 * in production code under standalone-scripts/macro-controller/src (excluding
 * __tests__). Compares against spec/33-missing-coding-guideline/99-baselines.json
 * (baselines.unknownOccurrencesProd, baselines.asUnknownAsDoubleCasts).
 *
 * Sequential fail-fast (mem://constraints/no-retry-policy):
 *   - Default: warn-only. Prints observed vs baseline.
 *   - --strict: exits 1 when observed > baseline. Reason=UnknownUsageRegression.
 *   - --json: machine-readable output.
 *
 * The gate is a ratchet: it only fires on REGRESSION. New passes that drive
 * counts below baseline should update 99-baselines.json in the same commit.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(REPO_ROOT, 'spec/33-missing-coding-guideline/99-baselines.json');
const SRC = join(REPO_ROOT, 'standalone-scripts/macro-controller/src');

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const AS_JSON = args.has('--json');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function count(files) {
  let unknownTotal = 0;
  let asUnknownAsTotal = 0;
  const unknownRe = /\bunknown\b/g;
  const asUnknownAsRe = /as\s+unknown\s+as\b/g;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    unknownTotal += (src.match(unknownRe) || []).length;
    asUnknownAsTotal += (src.match(asUnknownAsRe) || []).length;
  }
  return { unknownTotal, asUnknownAsTotal };
}

function main() {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const baseUnknown = baseline?.baselines?.unknownOccurrencesProd;
  const baseAsUnknown = baseline?.baselines?.asUnknownAsDoubleCasts;
  if (typeof baseUnknown !== 'number' || typeof baseAsUnknown !== 'number') {
    console.error('check-unknown-usage: baselines missing at ' + BASELINE_PATH);
    process.exit(2);
  }

  const files = walk(SRC);
  const { unknownTotal, asUnknownAsTotal } = count(files);

  const regressed =
    unknownTotal > baseUnknown || asUnknownAsTotal > baseAsUnknown;

  if (AS_JSON) {
    process.stdout.write(
      JSON.stringify(
        {
          unknownOccurrencesProd: unknownTotal,
          asUnknownAsDoubleCasts: asUnknownAsTotal,
          baseline: { unknownOccurrencesProd: baseUnknown, asUnknownAsDoubleCasts: baseAsUnknown },
          regressed,
        },
        null,
        2
      ) + '\n'
    );
  } else {
    console.log(
      `unknown: observed=${unknownTotal} baseline=${baseUnknown} | as-unknown-as: observed=${asUnknownAsTotal} baseline=${baseAsUnknown}`
    );
  }

  if (regressed && STRICT) {
    console.error(
      'Reason=UnknownUsageRegression ReasonDetail=' +
        `unknown ${unknownTotal}>${baseUnknown} or as-unknown-as ${asUnknownAsTotal}>${baseAsUnknown}`
    );
    process.exit(1);
  }
}

main();
