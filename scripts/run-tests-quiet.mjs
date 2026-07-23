#!/usr/bin/env node
/**
 * Quiet parallel test runner.
 *
 * Runs Vitest with maximum parallelism and suppresses stdout for
 * passing tests. Only failures, warnings, and the final summary
 * are printed. Preserves original loud runner (`pnpm run test`).
 *
 * Usage: node scripts/run-tests-quiet.mjs [...extra vitest args]
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { formatFailureReport, formatSuccessReport } from './lib/quiet-test-output.mjs';

const threadCount = Math.max(2, Math.min(cpus().length, 4));
const extra = process.argv.slice(2);

const args = [
  'vitest',
  'run',
  '--reporter=dot',
  '--pool=threads',
  `--poolOptions.threads.maxThreads=${threadCount}`,
  `--poolOptions.threads.minThreads=${Math.min(4, threadCount)}`,
  ...extra,
];

const child = spawn('pnpm', ['exec', ...args], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, CI: process.env.CI ?? '1' },
});

const stdoutChunks = [];
const stderrChunks = [];

child.stdout.on('data', (buf) => stdoutChunks.push(buf));
child.stderr.on('data', (buf) => stderrChunks.push(buf));

child.on('close', (code) => {
  const stdout = Buffer.concat(stdoutChunks).toString('utf8');
  const stderr = Buffer.concat(stderrChunks).toString('utf8');
  const failed = code !== 0;

  if (failed) {
    process.stderr.write(formatFailureReport(code ?? 1, stdout, stderr) + '\n');
    process.exit(code ?? 1);
    return;
  }

  process.stdout.write(formatSuccessReport(stdout, stderr) + '\n');
});
