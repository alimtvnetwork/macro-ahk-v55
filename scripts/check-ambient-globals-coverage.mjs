#!/usr/bin/env node
/**
 * check-ambient-globals-coverage.mjs
 *
 * Guarantees every tsconfig that consumes RiseupAsia ambient globals
 * actually pulls in the canonical declaration files at compile time.
 * If a tsconfig's `include` list, `types`, or triple-slash references
 * stop covering these files, TS2304 ("cannot find name
 * RiseupAsiaMacroExtNamespace") would regress silently. This guard
 * runs `tsc --noEmit --listFiles` per project and asserts each
 * required declaration file is in the resolved file set.
 *
 * Wired into CI (see .github/workflows/ci.yml, job typecheck-standalone).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Each entry: tsconfig path + declaration files it MUST resolve.
 * Paths are repo-relative; normalized before matching.
 */
const REQUIREMENTS = [
  {
    tsconfig: 'tsconfig.macro.build.json',
    required: [
      'standalone-scripts/types/riseup-namespace.d.ts',
      'standalone-scripts/macro-controller/src/globals.d.ts',
    ],
  },
  {
    tsconfig: 'tsconfig.macro-controller.json',
    required: [
      'standalone-scripts/types/riseup-namespace.d.ts',
      'standalone-scripts/macro-controller/src/globals.d.ts',
    ],
  },
  {
    tsconfig: 'tsconfig.sdk.json',
    required: ['standalone-scripts/types/riseup-namespace.d.ts'],
  },
  {
    tsconfig: 'tsconfig.marco-sdk.json',
    required: ['standalone-scripts/types/riseup-namespace.d.ts'],
  },
  {
    tsconfig: 'tsconfig.payment-banner-hider.json',
    required: [
      'standalone-scripts/types/riseup-namespace.d.ts',
      'standalone-scripts/payment-banner-hider/src/globals.d.ts',
    ],
  },
];

const repoRoot = process.cwd();
const failures = [];

for (const { tsconfig, required } of REQUIREMENTS) {
  if (!existsSync(path.join(repoRoot, tsconfig))) {
    failures.push(`Missing tsconfig: ${tsconfig}`);
    continue;
  }
  let listing;
  try {
    listing = execFileSync(
      'npx',
      ['tsc', '--noEmit', '--listFiles', '-p', tsconfig],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (err) {
    // tsc may exit non-zero on type errors but still print --listFiles output on stdout.
    listing = (err.stdout || '').toString();
    if (!listing) {
      failures.push(`tsc failed for ${tsconfig} with no --listFiles output: ${err.message}`);
      continue;
    }
  }
  const normalized = listing
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((abs) => path.relative(repoRoot, abs).split(path.sep).join('/'));
  const resolved = new Set(normalized);
  for (const need of required) {
    if (!resolved.has(need)) {
      failures.push(`${tsconfig} does not include ${need}`);
    }
  }
}

if (failures.length > 0) {
  console.error('[check-ambient-globals-coverage] FAIL');
  for (const f of failures) console.error('  - ' + f);
  console.error('\nEach tsconfig above must include the RiseupAsia ambient declaration');
  console.error('files via `include`, `files`, or triple-slash references so that global');
  console.error('types (RiseupAsiaMacroExtNamespace, Window.RiseupAsiaMacroExt) resolve.');
  process.exit(1);
}

console.log('[check-ambient-globals-coverage] OK: all tsconfigs resolve required ambient globals.');
