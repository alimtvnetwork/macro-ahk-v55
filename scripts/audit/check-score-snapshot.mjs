#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_ARG = '--root=';
const SNAPSHOT_ARG = '--snapshot=';
const UPDATE_FLAG = '--update';
const DEFAULT_SPEC_ROOT = 'spec/2026-spec';
const DEFAULT_SNAPSHOT = 'spec/2026-spec/_audit-2026-06-05/scores.snapshot.json';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const AUDIT_SCAN_SCRIPT = resolve(SCRIPT_DIR, 'audit-scan.py');

const specRoot = getArg(ROOT_ARG, DEFAULT_SPEC_ROOT);
const snapshotPath = resolve(getArg(SNAPSHOT_ARG, DEFAULT_SNAPSHOT));
const updateMode = process.argv.includes(UPDATE_FLAG);

const currentRows = readScoreRows(specRoot);
const currentFiles = toFileMap(currentRows);
const currentComposite = computeComposite(currentFiles);

if (updateMode) {
  writeSnapshot(snapshotPath, specRoot, currentFiles, currentComposite);
  process.stdout.write(`[check-score-snapshot] wrote snapshot → ${snapshotPath} (${Object.keys(currentFiles).length} files, composite ${formatNumber(currentComposite)})\n`);
  process.exit(0);
}

if (!existsSync(snapshotPath)) {
  writeMissingSnapshot(snapshotPath);
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const failures = collectFailures(snapshot, currentFiles, currentComposite, specRoot);

if (failures.length === 0) {
  process.stdout.write(`[check-score-snapshot] OK — ${Object.keys(currentFiles).length} files, composite ${formatNumber(currentComposite)} >= snapshot ${formatNumber(snapshot.minComposite)}\n`);
  process.exit(0);
}

writeFailureReport(failures);
process.exit(1);

function getArg(prefix, fallback) {
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function readScoreRows(rootPath) {
  const result = spawnSync('python3', [AUDIT_SCAN_SCRIPT, rootPath], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write('[check-score-snapshot] CODE RED — audit scanner failed:\n');
    process.stderr.write(`  - path: ${resolve(rootPath)}\n`);
    process.stderr.write('    missing: score JSON from scripts/audit/audit-scan.py\n');
    process.stderr.write(`    reason: ${result.stderr}\n`);
    process.exit(1);
  }
  return JSON.parse(result.stdout);
}

function toFileMap(rows) {
  const map = {};
  for (const row of rows) {
    map[row.path] = row.score;
  }
  return map;
}

function computeComposite(files) {
  const values = Object.values(files);
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectFailures(snapshot, currentMap, currentComposite, rootPath) {
  return [
    ...collectMissingFailures(snapshot, currentMap, rootPath),
    ...collectRegressionFailures(snapshot, currentMap, rootPath),
    ...collectCompositeFailures(snapshot, currentComposite, rootPath),
  ];
}

function collectMissingFailures(snapshot, currentMap, rootPath) {
  const items = [];
  for (const [relPath, snapScore] of Object.entries(snapshot.files)) {
    if (currentMap[relPath] === undefined) {
      items.push({
        path: resolve(rootPath, relPath),
        missing: `file present in snapshot (score ${snapScore})`,
        reason: 'File removed or renamed since snapshot. Run with --update after intentional changes.',
      });
    }
  }
  return items;
}

function collectRegressionFailures(snapshot, currentMap, rootPath) {
  const items = [];
  for (const [relPath, snapScore] of Object.entries(snapshot.files)) {
    const currentScore = currentMap[relPath];
    if (currentScore !== undefined && currentScore < snapScore) {
      items.push({
        path: resolve(rootPath, relPath),
        missing: `score >= ${snapScore} (snapshot lock)`,
        reason: `Score regressed to ${currentScore}. Restore content or rerun with --update if regression is intentional.`,
      });
    }
  }
  return items;
}

function collectCompositeFailures(snapshot, currentComposite, rootPath) {
  if (currentComposite >= snapshot.minComposite) {
    return [];
  }
  return [{
    path: resolve(rootPath),
    missing: `composite >= ${formatNumber(snapshot.minComposite)} (snapshot lock)`,
    reason: `Composite regressed to ${formatNumber(currentComposite)}.`,
  }];
}

function writeSnapshot(targetPath, rootPath, files, composite) {
  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    specRoot: rootPath,
    minComposite: Number(composite.toFixed(4)),
    files,
  };
  writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeMissingSnapshot(targetPath) {
  process.stderr.write('[check-score-snapshot] CODE RED — snapshot lock missing:\n');
  process.stderr.write(`  - path: ${targetPath}\n`);
  process.stderr.write('    missing: scores.snapshot.json baseline\n');
  process.stderr.write('    reason: run `node scripts/audit/check-score-snapshot.mjs --update` to seed the snapshot.\n');
}

function writeFailureReport(items) {
  process.stderr.write(`[check-score-snapshot] CODE RED — ${items.length} snapshot regression(s):\n`);
  for (const item of items) {
    process.stderr.write(`  - path: ${item.path}\n`);
    process.stderr.write(`    missing: ${item.missing}\n`);
    process.stderr.write(`    reason: ${item.reason}\n`);
  }
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2);
}
