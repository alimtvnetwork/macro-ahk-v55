import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

test('audit-timer-teardown.mjs runs and emits JSON', () => {
  execSync('node scripts/audit-timer-teardown.mjs', { stdio: 'pipe' });
  assert.ok(existsSync('public/timer-teardown-audit.json'));
  const j = JSON.parse(readFileSync('public/timer-teardown-audit.json', 'utf8'));
  assert.ok(typeof j.totalFindings === 'number');
  assert.ok(Array.isArray(j.findings));
});

test('audit-timer-teardown.mjs keeps remediated P0 batch files clean', () => {
  execSync('node scripts/audit-timer-teardown.mjs', { stdio: 'pipe' });
  const j = JSON.parse(readFileSync('public/timer-teardown-audit.json', 'utf8'));
  const findingFiles = new Set(j.findings.map((finding) => finding.file));
  const remediatedFiles = [
    'src/background/handlers/injection-toast.ts',
    'src/background/csp-fallback.ts',
    'src/content-scripts/network-reporter.ts',
    'src/background/first-attach-toast.ts',
    'src/background/recorder/step-library/hotkey-executor.ts',
    'src/background/condition-evaluator.ts',
    'src/background/recorder/condition-evaluator.ts',
    'src/background/recorder/live-dom-replay.ts',
    'src/background/recorder/step-library/step-wait.ts',
    'src/background/session-log-writer.ts',
  ];

  for (const file of remediatedFiles) {
    assert.equal(findingFiles.has(file), false, `${file} should not regress into timer-teardown findings`);
  }
});
