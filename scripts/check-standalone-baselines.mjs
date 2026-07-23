#!/usr/bin/env node
/**
 * check-standalone-baselines.mjs — Plan-17 step 2 (SS-02 baseline check scaffold).
 *
 * Reads spec/33-missing-coding-guideline/99-baselines.json and refuses to let
 * measurable code-quality metrics rise above the pinned baseline for
 * standalone-scripts/**. Sequential fail-fast (mem://constraints/no-retry-policy):
 * on regression, log Reason='StandaloneBaselineRegression' with ReasonDetail
 * and exit 1. No retry, no backoff.
 *
 * Flags:
 *   --report        : print every metric with observed vs baseline (no exit code change)
 *   --json          : machine-readable output
 *   --only=metric,..: measure only the listed metrics
 *
 * Only cheap, shell-only metrics are implemented in this scaffold. Later
 * steps (Plan-17 step 3, 8, 13, 18, 21, 24, 28) wire the AST-heavy metrics
 * (madge cycles, ts-prune, silent-catch AST scan, observer teardown) as
 * dedicated check-* scripts that plug into the same JSON contract.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(REPO_ROOT, 'spec/33-missing-coding-guideline/99-baselines.json');
const ROOT = join(REPO_ROOT, 'standalone-scripts');
const UI_GLOB_HINT = 'standalone-scripts/**/ui/**';

const args = process.argv.slice(2);
const REPORT_ONLY = args.includes('--report');
const AS_JSON = args.includes('--json');
const ONLY = (args.find((a) => a.startsWith('--only=')) ?? '').replace('--only=', '')
  .split(',').filter(Boolean);

function fail(reason, detail) {
  const line = 'Reason=StandaloneBaselineRegression ReasonDetail="' + detail + '"';
  if (AS_JSON) console.log(JSON.stringify({ ok: false, reason, detail }));
  else console.error('[check-standalone-baselines] ' + line);
  process.exit(1);
}

/** Walk standalone-scripts/**\/*.ts (skips dist, node_modules, __tests__ for prod metrics). */
function* walkTs(dir, opts = {}) {
  const skipTests = opts.skipTests !== false;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.turbo') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (skipTests && (name === '__tests__' || name === 'tests')) continue;
      yield* walkTs(p, opts);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) {
      yield p;
    }
  }
}

function countRegex(re, opts) {
  let total = 0;
  for (const f of walkTs(ROOT, opts)) {
    if (opts?.uiOnly && !f.includes('/ui/')) continue;
    const txt = readFileSync(f, 'utf8');
    const m = txt.match(re);
    if (m) total += m.length;
  }
  return total;
}

const measurers = {
  innerHTMLSinks: () => countRegex(/\.innerHTML\s*=/g),
  newFunctionSites: () => countRegex(/\bnew\s+Function\s*\(/g),
  unauthorizedConsoleError: () => countRegex(/console\.error\s*\(/g),
  asUnknownAsDoubleCasts: () => countRegex(/\bas\s+unknown\s+as\b/g),
  hexLiteralsInUi: () => countRegex(/#[0-9a-fA-F]{3,8}\b/g, { uiOnly: true }),
  rgbLiteralsInUi: () => countRegex(/\brgba?\s*\(/g, { uiOnly: true }),
  addEventListenerCount: () => countRegex(/\.addEventListener\s*\(/g),
  removeEventListenerCount: () => countRegex(/\.removeEventListener\s*\(/g),
  rawLocalStorageLiteralKeys: () => countRegex(/localStorage\.(get|set|remove)Item\s*\(\s*['"`]/g),
};

const baselineDoc = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const baselines = baselineDoc.baselines ?? {};

const results = [];
for (const [metric, measure] of Object.entries(measurers)) {
  if (ONLY.length && !ONLY.includes(metric)) continue;
  const baseline = baselines[metric];
  if (typeof baseline !== 'number') continue;
  const observed = measure();
  results.push({ metric, observed, baseline, delta: observed - baseline });
}

if (REPORT_ONLY || AS_JSON) {
  if (AS_JSON) console.log(JSON.stringify({ ok: true, results, uiGlob: UI_GLOB_HINT }, null, 2));
  else {
    console.log('metric                              observed  baseline  delta');
    for (const r of results) {
      console.log(
        r.metric.padEnd(36) + String(r.observed).padStart(8) +
        String(r.baseline).padStart(10) + String(r.delta).padStart(7),
      );
    }
  }
  process.exit(0);
}

for (const r of results) {
  if (r.observed > r.baseline) {
    fail('StandaloneBaselineRegression',
      r.metric + ': observed ' + r.observed + ' > baseline ' + r.baseline);
  }
}

console.log('[check-standalone-baselines] OK — ' + results.length + ' metrics at or below baseline.');
