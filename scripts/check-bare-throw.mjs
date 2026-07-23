#!/usr/bin/env node
/**
 * check-bare-throw.mjs
 *
 * Regression gate for Plan 27. Fails CI if any file under
 * `standalone-scripts/macro-controller/src/**` throws a raw `Error` /
 * `new Error(...)` instead of using the `DiagnosticError` registry.
 *
 * Exclusions:
 *   - Anything under `errors/` (the registry itself constructs Errors)
 *   - Test files: `**\/__tests__/**`, `*.test.ts`, `*.spec.ts`
 *   - Lines with `// allow-bare-throw` (documented pragmatic escapes)
 *
 * Usage: node scripts/check-bare-throw.mjs [--root <dir>]
 * Exit 0 = clean. Exit 1 = one or more violations printed with file:line.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const rootArgIdx = args.indexOf("--root");
const ROOT = rootArgIdx >= 0 && args[rootArgIdx + 1]
  ? args[rootArgIdx + 1]
  : "standalone-scripts/macro-controller/src";

const THROW_RX = /\bthrow\s+(?:new\s+)?Error\s*\(/;
const ALLOW_MARKER = "allow-bare-throw";

function isExcluded(relPath) {
  const parts = relPath.split(sep);
  if (parts.includes("errors")) return true;
  if (parts.includes("__tests__")) return true;
  if (relPath.endsWith(".test.ts") || relPath.endsWith(".spec.ts")) return true;
  if (relPath.endsWith(".d.ts")) return true;
  return false;
}

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile() && full.endsWith(".ts")) out.push(full);
  }
  return out;
}

const violations = [];
const files = walk(ROOT);
for (const file of files) {
  const rel = relative(process.cwd(), file);
  if (isExcluded(rel)) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!THROW_RX.test(line)) continue;
    if (line.includes(ALLOW_MARKER)) continue;
    violations.push({ file: rel, line: i + 1, text: line.trim() });
  }
}

if (violations.length === 0) {
  const label = `check-bare-throw: 0 bare throws in ${ROOT} (${files.length} .ts files scanned)`;
  console.log(`\x1b[32m✓ ${label}\x1b[0m`);
  process.exit(0);
}

console.error(`\x1b[31m✗ check-bare-throw: ${violations.length} bare throw(s) found\x1b[0m`);
console.error("  Use DiagnosticError from standalone-scripts/macro-controller/src/errors/,");
console.error("  or annotate an intentional case with a trailing `// allow-bare-throw` comment.\n");
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.text}`);
}
process.exit(1);
