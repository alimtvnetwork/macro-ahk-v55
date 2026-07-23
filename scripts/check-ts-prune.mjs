#!/usr/bin/env node
/**
 * check-ts-prune.mjs — Plan-17 step 28 (barrel prune + unused-export gate).
 *
 * Runs `ts-prune -p tsconfig.macro.build.json` and compares the observed
 * unused-export count with `spec/33-missing-coding-guideline/99-baselines.json`
 * (`baselines.unusedExports`, currently pinned at 278 with target 50).
 *
 * Behavior:
 *   - Default (warn-only): prints observed vs baseline and exits 0. Lets
 *     subsequent Plan-17 barrel-prune passes burn the count down.
 *   - `--strict`: exits 1 when observed > baseline. Reason=`TsPruneRegression`.
 *     Sequential fail-fast (mem://constraints/no-retry-policy).
 *   - `--json`: machine-readable output.
 *   - `--report`: list every unused export.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(REPO_ROOT, 'spec/33-missing-coding-guideline/99-baselines.json');
const TSCONFIG = 'tsconfig.macro.build.json';

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const AS_JSON = args.has('--json');
const REPORT = args.has('--report');

function readBaseline() {
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const n = raw?.baselines?.unusedExports;
  if (typeof n !== 'number') {
    throw new Error(
      'check-ts-prune: baseline missing at ' + BASELINE_PATH +
      ' -> baselines.unusedExports (expected number)'
    );
  }
  return n;
}

function runTsPrune() {
  const result = spawnSync('npx', ['--no-install', 'ts-prune', '-p', TSCONFIG], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(
      'check-ts-prune: ts-prune failed to spawn — ' + result.error.message +
      '. Install with `npm i -D ts-prune`. Reason=TsPruneSpawnError'
    );
  }
  if (result.status !== 0 && result.status !== 1) {
    // ts-prune exits 0 with results; anything unusual is a hard error.
    throw new Error(
      'check-ts-prune: ts-prune exited ' + result.status + '\n' + (result.stderr || '')
    );
  }
  return result.stdout || '';
}

function parseLines(stdout) {
  return stdout
    .split(/\r?\n/)
    .map(function (l) { return l.trim(); })
    .filter(function (l) {
      if (l.length === 0) return false;
      if (l.startsWith('-')) return false; // ts-prune banner lines
      return /:\d+ - /.test(l);
    });
}

function main() {
  const baseline = readBaseline();
  const stdout = runTsPrune();
  const items = parseLines(stdout);
  const observed = items.length;
  const regressed = observed > baseline;
  const payload = {
    tool: 'check-ts-prune',
    baseline: baseline,
    observed: observed,
    delta: observed - baseline,
    regressed: regressed,
    strict: STRICT,
  };
  if (AS_JSON) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  } else {
    process.stdout.write(
      '[check-ts-prune] unused exports: observed=' + observed +
      ' baseline=' + baseline +
      ' delta=' + (observed - baseline) +
      (regressed ? ' REGRESSION' : ' ok') + '\n'
    );
    if (REPORT) {
      for (const line of items) process.stdout.write('  ' + line + '\n');
    }
  }
  if (regressed && STRICT) {
    process.stderr.write(
      'Reason=TsPruneRegression: unused exports rose from ' + baseline +
      ' to ' + observed + '. Delete the export or reconnect a caller.\n'
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
