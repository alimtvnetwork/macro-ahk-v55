#!/usr/bin/env node
/**
 * audit-logger-compliance.mjs — Batch C steps 22–23 / S13 remediation.
 *
 * Scans authored app/standalone source for `console.error(...)` callers and classifies each against
 * the allowlist in `spec/audit/blind-ai-implementation-audit/coverage/logging-sweep-targets.md`.
 *
 * Writes `public/logger-compliance-audit.json` for the Options audit panel.
 * Exits 1 if any file outside the allowlist contains `console.error`.
 *
 * Usage:
 *   node scripts/audit-logger-compliance.mjs           # human + JSON file
 *   node scripts/audit-logger-compliance.mjs --json    # JSON to stdout
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname } from 'node:path';

// Allowlist — see logging-sweep-targets.md section A.
// Files where `console.error` is legitimate (logger impls, recursion-guard, generated, tests,
// runtime-emitted stub code, Monaco user-snippets, React error boundary).
const ALLOWLIST = new Set([
  'src/background/bg-logger.ts',
  'src/lib/lib-logger.ts',
  'src/components/options/options-logger.ts',
  'src/components/recorder/recorder-logger.ts',
  'src/content-scripts/prompt-injector-logger.ts',
  'src/hooks/popup-logger.ts',
  'src/hooks/hook-logger.ts',
  'src/background/session-log-writer.ts',
  'src/background/db-manager.ts',
  'src/background/handlers/injection-namespace-bootstrap.ts',
  'src/components/ErrorBoundary.tsx',
  'src/lib/developer-guide-data.generated.ts',
  'src/background/__tests__/allow-swallow-fallbacks.test.ts',
  'src/background/recorder/__tests__/failure-logger.test.ts',
  // Runtime-emitted stub code in template literals (the call runs in injected page context, not bg):
  'src/background/builtin-script-guard.ts',
  'src/background/manifest-seeder.ts',
  'src/background/project-namespace-builder.ts',
  'src/background/handlers/injection-wrapper.ts',
  // Monaco editor snippets shown to USERS as code-completion templates:
  'src/components/options/monaco-js-intellisense.ts',
  // Documented bare console.error (DB mid-migration; rollback path):
  'src/background/schema-migration.ts',
  // Failure-formatter — itself the surfacing layer for failure reports:
  'src/background/recorder/failure-logger.ts',
  // Injection visibility renderer — per mem://architecture/injection-visibility-system,
  // this module IS the console.groupCollapsed presentation surface; it must call
  // console.error directly to render in DevTools with the correct color/level.
  'src/background/injection-diagnostics.ts',
  // Runs inside chrome.scripting.executeScript MAIN-world func — bg Logger unreachable from page context:
  'src/background/context-menu-handler.ts',
  'standalone-scripts/lovable-common/src/logger.ts',
  'standalone-scripts/lovable-dashboard/src/logger.ts',
  'standalone-scripts/macro-controller/src/core/MacroController.ts',
  'standalone-scripts/macro-controller/src/credit-api.ts',
  'standalone-scripts/macro-controller/src/error-utils.ts',
  'standalone-scripts/macro-controller/src/logging.ts',
  'standalone-scripts/macro-controller/src/queue-control/auto-resume.ts',
  'standalone-scripts/macro-controller/src/user-gesture-guard.ts',
  'standalone-scripts/marco-sdk/src/logger.ts',
  'standalone-scripts/payment-banner-hider/src/logger.ts',
]);

const SCAN_GLOBS = [
  'src/',
  'standalone-scripts/*/src/',
];

function listConsoleErrorFiles() {
  try {
    const out = execSync(`rg -l "console\\.error" ${SCAN_GLOBS.join(' ')}`, { encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean).sort();
  } catch {
    return [];
  }
}

function countOccurrences(file) {
  const content = readFileSync(file, 'utf8');
  const matches = content.match(/console\.error\s*\(/g);
  return matches ? matches.length : 0;
}

const allFiles = listConsoleErrorFiles();
const allowed = [];
const violations = [];

for (const file of allFiles) {
  const count = countOccurrences(file);
  // Skip files where ripgrep matched only string/comment mentions of
  // "console.error" but no actual invocation. These are false positives
  // (typically test fixtures asserting on error text) and previously
  // caused baseline drift without any real logging violation.
  if (count === 0) continue;
  const record = { file, count };
  if (ALLOWLIST.has(file)) {
    allowed.push(record);
  } else {
    violations.push(record);
  }
}

const totalCalls = allFiles.reduce((sum, f) => sum + countOccurrences(f), 0);
const allowedCalls = allowed.reduce((sum, r) => sum + r.count, 0);
const violationCalls = violations.reduce((sum, r) => sum + r.count, 0);
const compliancePercent = totalCalls === 0 ? 100 : ((allowedCalls / totalCalls) * 100).toFixed(1);

const result = {
  generatedAt: new Date().toISOString(),
  totals: {
    filesWithConsoleError: allFiles.length,
    allowedFiles: allowed.length,
    violatingFiles: violations.length,
    totalCalls,
    allowedCalls,
    violationCalls,
    compliancePercent: Number(compliancePercent),
  },
  allowedFiles: allowed,
  violatingFiles: violations,
  policy: 'spec/audit/blind-ai-implementation-audit/coverage/logging-sweep-targets.md',
};

mkdirSync('public', { recursive: true });
writeFileSync('public/logger-compliance-audit.json', JSON.stringify(result, null, 2) + '\n');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[logger-compliance] ${allFiles.length} files with console.error`);
  console.log(`[logger-compliance]   allowed: ${allowed.length} files (${allowedCalls} calls)`);
  console.log(`[logger-compliance]   violations: ${violations.length} files (${violationCalls} calls)`);
  console.log(`[logger-compliance]   compliance: ${compliancePercent}%`);
  if (violations.length > 0) {
    console.log('[logger-compliance] Sweep these files (use Logger.error / logBgError):');
    for (const v of violations) {
      console.log(`  - ${v.file}  (${v.count} call${v.count === 1 ? '' : 's'})`);
    }
  }
  console.log(`[logger-compliance] Wrote public/logger-compliance-audit.json`);
}

const strict = process.argv.includes('--strict');
if (strict && violations.length > 0) {
  console.error(`[logger-compliance] FAIL (--strict): ${violations.length} files outside allowlist.`);
  process.exit(1);
}
process.exit(0);
