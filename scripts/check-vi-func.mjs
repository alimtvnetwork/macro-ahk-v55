#!/usr/bin/env node
/**
 * Ban `vi.func` — Vitest's mock factory is `vi.fn`, not `vi.func`.
 *
 * Companion to the ESLint rule in eslint.config.js
 * (`no-restricted-syntax` → MemberExpression `vi.func`). This CI guard
 * runs even when ESLint is skipped/downgraded so the regression can
 * never land twice.
 *
 * Implementation note: originally shelled out to ripgrep, but CI images
 * do not always ship `rg` (`/bin/sh: 1: rg: not found`). This version is
 * Node-native — no external binaries, no shell — so it works in every
 * environment.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

function parseRoot() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--root");
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.cwd();
}
const ROOT = parseRoot();

// Directory names skipped entirely (matched anywhere in the path).
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  ".turbo",
  "coverage",
  ".vite",
]);

// Files skipped by exact repo-relative path (POSIX separators).
const SKIP_FILES = new Set([
  "scripts/check-vi-func.mjs",
  "scripts/__tests__/check-vi-func.test.mjs",
  "eslint.config.js",
]);

// Basenames skipped anywhere (changelogs / release descriptors that
// legitimately mention the ban).
const SKIP_BASENAMES = new Set([
  "changelog.md",
]);

// Path prefixes skipped anywhere (workflow files and release descriptors
// reference the ban text itself, and are not test code).
const SKIP_PREFIXES = [
  ".github/workflows/",
  ".gitmap/",
];


// Only scan source-ish text files. Binary/asset extensions are ignored.
const SCAN_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".md", ".mdx", ".json", ".yml", ".yaml",
]);

const PATTERN = /\bvi\.func\b/;

/** @type {{file: string, line: number, text: string}[]} */
const hits = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walk(abs);
      continue;
    }
    if (!entry.isFile()) continue;

    const relPath = relative(ROOT, abs).split(sep).join("/");
    if (SKIP_FILES.has(relPath)) continue;
    if (SKIP_BASENAMES.has(entry.name.toLowerCase())) continue;
    if (SKIP_PREFIXES.some((p) => relPath.startsWith(p))) continue;

    const dot = entry.name.lastIndexOf(".");
    const ext = dot >= 0 ? entry.name.slice(dot).toLowerCase() : "";
    if (!SCAN_EXT.has(ext)) continue;

    let stat;
    try { stat = statSync(abs); } catch { continue; }
    if (stat.size > 5 * 1024 * 1024) continue; // skip >5MB safety

    let content;
    try { content = readFileSync(abs, "utf8"); } catch { continue; }
    if (!PATTERN.test(content)) continue;

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (PATTERN.test(lines[i])) {
        hits.push({ file: relPath, line: i + 1, text: lines[i].trim() });
      }
    }
  }
}

walk(ROOT);

if (hits.length > 0) {
  console.error("[check-vi-func] FAIL: found vi.func usages.");
  console.error("Vitest exposes `vi.fn` (mock factory), not `vi.func`.");
  console.error("Replace every `vi.func` with `vi.fn`:");
  console.error("");
  for (const hit of hits) {
    console.error(`${hit.file}:${hit.line}:${hit.text}`);
  }
  process.exit(1);
}

console.log("[check-vi-func] OK: no vi.func usages found.");
