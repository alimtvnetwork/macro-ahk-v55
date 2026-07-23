#!/usr/bin/env node
/**
 * check-madge-cycles.mjs — Plan-17 step 3 (PR-A prep, warn-only phase).
 *
 * Runs `madge --circular --extensions ts --json` against
 * standalone-scripts/macro-controller/src and compares the observed cycle
 * count with `spec/33-missing-coding-guideline/99-baselines.json`
 * (`baselines.macroControllerCycles`, currently pinned at 57).
 *
 * Behavior:
 *   - Default (warn-only): prints observed vs baseline and exits 0 even on
 *     regression. This lets subsequent Plan-17 steps (4-6) burn cycles down
 *     safely; step 7 flips this to `--strict` and wires it into CI.
 *   - `--strict`: exits 1 when observed > baseline
 *     (Reason='MadgeCyclesRegression'). No retry, no backoff
 *     (mem://constraints/no-retry-policy).
 *   - `--json`: machine-readable output.
 *   - `--report`: list every cycle path.
 *
 * Sequential fail-fast on tool errors — never swallows madge failures.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(REPO_ROOT, 'spec/33-missing-coding-guideline/99-baselines.json');
const TARGET = 'standalone-scripts/macro-controller/src';

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const AS_JSON = args.has('--json');
const REPORT = args.has('--report');

function readBaseline() {
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const n = raw?.baselines?.macroControllerCycles;
  if (typeof n !== 'number') {
    throw new Error(
      'check-madge-cycles: baseline missing at ' + BASELINE_PATH +
      ' -> baselines.macroControllerCycles (expected number)'
    );
  }
  return n;
}

function runMadge() {
  const result = spawnSync(
    'npx',
    ['--yes', 'madge', '--circular', '--extensions', 'ts', '--json', TARGET],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.error) {
    throw new Error('check-madge-cycles: madge failed to spawn: ' + result.error.message);
  }
  if (result.status !== 0 && result.status !== 1) {
    // madge exits 1 when cycles are found — that's expected, not a tool error.
    throw new Error(
      'check-madge-cycles: madge exited ' + result.status + '\nstderr:\n' + result.stderr
    );
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    throw new Error('check-madge-cycles: could not parse madge JSON output: ' + e.message);
  }
}

function main() {
  const baseline = readBaseline();
  const cycles = runMadge();
  const observed = cycles.length;
  const delta = observed - baseline;
  const regressed = observed > baseline;

  const payload = {
    metric: 'macroControllerCycles',
    target: TARGET,
    baseline,
    observed,
    delta,
    regressed,
    mode: STRICT ? 'strict' : 'warn-only',
  };

  if (AS_JSON) {
    if (REPORT) payload.cycles = cycles;
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log('[check-madge-cycles] ' + TARGET);
    console.log('  baseline : ' + baseline);
    console.log('  observed : ' + observed);
    console.log('  delta    : ' + (delta > 0 ? '+' : '') + delta);
    console.log('  mode     : ' + payload.mode);
    if (REPORT) {
      cycles.forEach((c, i) => console.log('  #' + (i + 1) + ' ' + c.join(' > ')));
    }
  }

  if (regressed) {
    const line = 'Reason=MadgeCyclesRegression ReasonDetail="' + observed +
      ' circular deps in ' + TARGET + ' > baseline ' + baseline + '"';
    if (STRICT) {
      console.error('[check-madge-cycles] ' + line);
      process.exit(1);
    }
    console.warn('[check-madge-cycles] WARN (warn-only phase): ' + line);
  }
}

try {
  main();
} catch (e) {
  console.error('[check-madge-cycles] Reason=CheckerFailed ReasonDetail="' + e.message + '"');
  process.exit(2);
}
