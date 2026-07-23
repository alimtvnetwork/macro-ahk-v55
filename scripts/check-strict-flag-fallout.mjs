#!/usr/bin/env node
/**
 * check-strict-flag-fallout.mjs - Plan-17 step 30 preflight report.
 *
 * Enables each pending strict tsconfig flag one at a time against
 * tsconfig.macro.build.json and reports the resulting `error TS` count
 * WITHOUT persisting the change. Non-fatal by default (report-only) so
 * remediation can plan flag-by-flag rollout against the baseline.
 *
 * Flags checked (already-enabled flags are skipped):
 *   - noUncheckedIndexedAccess
 *   - exactOptionalPropertyTypes
 *   - noImplicitOverride
 *   - noPropertyAccessFromIndexSignature
 *
 * Sequential fail-fast (mem://constraints/no-retry-policy):
 *   - Default: prints per-flag error counts, exits 0.
 *   - --strict: ratchet gate. Exits 1 when any pending flag's error count
 *     exceeds the recorded baseline in
 *     `spec/33-missing-coding-guideline/99-baselines.json`
 *     (`baselines.strictFlagFallout`). Also exits 1 when a flag listed as
 *     `already-enabled` regresses back to `pending`.
 *   - --json: machine-readable output.
 *
 * Restores tsconfig.macro.json exactly on any exit path (including SIGINT).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CFG = join(REPO_ROOT, 'tsconfig.macro.json');
const BUILD_CFG = 'tsconfig.macro.build.json';
const BASELINES = join(REPO_ROOT, 'spec/33-missing-coding-guideline/99-baselines.json');

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const AS_JSON = args.has('--json');

const FLAGS = [
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'noImplicitOverride',
  'noPropertyAccessFromIndexSignature',
];

const original = readFileSync(CFG, 'utf8');
const restore = () => writeFileSync(CFG, original);
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

function runTsc() {
  const r = spawnSync('npx', ['tsc', '--noEmit', '-p', BUILD_CFG], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const matches = out.match(/error TS/g) || [];
  return matches.length;
}

function withFlag(flag) {
  const cfg = JSON.parse(original);
  cfg.compilerOptions ??= {};
  cfg.compilerOptions[flag] = true;
  writeFileSync(CFG, JSON.stringify(cfg, null, 2));
  try {
    return runTsc();
  } finally {
    restore();
  }
}

function main() {
  const baselineCfg = JSON.parse(original).compilerOptions ?? {};
  const results = {};
  for (const flag of FLAGS) {
    if (baselineCfg[flag] === true) {
      results[flag] = { status: 'already-enabled', errors: 0 };
      continue;
    }
    const errors = withFlag(flag);
    results[flag] = { status: 'pending', errors };
  }

  if (AS_JSON) {
    process.stdout.write(JSON.stringify({ results }, null, 2) + '\n');
  } else {
    for (const [flag, r] of Object.entries(results)) {
      console.log(`${flag}: ${r.status} errors=${r.errors}`);
    }
  }

  if (STRICT) {
    let baselineMap = {};
    try {
      const raw = JSON.parse(readFileSync(BASELINES, 'utf8'));
      baselineMap = (raw.baselines && raw.baselines.strictFlagFallout) || {};
    } catch (readErr) {
      console.error(
        `Reason=StrictFlagFalloutBaselineMissing ReasonDetail=cannot read ${BASELINES}: ${readErr.message}`
      );
      process.exit(1);
    }
    const regressions = [];
    for (const [flag, r] of Object.entries(results)) {
      const floor = typeof baselineMap[flag] === 'number' ? baselineMap[flag] : 0;
      if (r.status === 'already-enabled') {
        if (floor !== 0) {
          regressions.push(`${flag}: already-enabled but baseline=${floor} (expected 0)`);
        }
        continue;
      }
      if (r.errors > floor) {
        regressions.push(`${flag}: errors=${r.errors} exceeds baseline=${floor}`);
      }
    }
    if (regressions.length > 0) {
      console.error(
        'Reason=StrictFlagFallout ReasonDetail=strict-flag error count regressed above baseline'
      );
      for (const line of regressions) console.error(`  - ${line}`);
      console.error(
        `Update spec/33-missing-coding-guideline/99-baselines.json only when lowering the floor.`
      );
      process.exit(1);
    }
  }
}

main();
