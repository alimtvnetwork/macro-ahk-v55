#!/usr/bin/env node
/**
 * fix-markdown-filenames.mjs
 *
 * Auto-fixes mixed-case `.md` filenames so the repo passes
 * `scripts/check-markdown-filenames.mjs`.
 *
 * Rules applied (matching the checker):
 *   - `SS-*.md` under `.lovable/plans/subtasks/**` -> strip the `SS-` prefix
 *     so the file starts with the numeric sequence (e.g. `SS-01-scope.md`
 *     becomes `01-scope.md`).
 *   - Any other mixed-case `.md` basename that is not already lowercase
 *     hyphen-case or ALL-CAPS gets lowercased and its spaces/underscores
 *     collapsed to `-`.
 *
 * Excluded roots mirror the checker: `.git`, `node_modules`, `skipped`,
 * `.release`.
 *
 * Prints the rename plan to stdout. Set `DRY_RUN=1` to preview without
 * touching disk. Exit code is `0` when nothing needed fixing, `0` when
 * fixes were applied cleanly, and non-zero on IO failure.
 */

import { readdirSync, renameSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const ROOT = process.argv[2] ?? ".";
const DRY_RUN = process.env.DRY_RUN === "1";
const EXCLUDED_DIRS = new Set([".git", "node_modules", "skipped", ".release"]);
const LOWERCASE_HYPHEN = /^[a-z0-9][a-z0-9-]*$/u;
const ALL_CAPS_DOC = /^[A-Z0-9][A-Z0-9_-]*$/u;

function walk(directory, prefix = "") {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        out.push(...walk(join(directory, entry.name), rel));
      }
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

function isSubtaskPath(rel) {
  const parts = rel.split("/");
  return parts[0] === ".lovable"
    && parts[1] === "plans"
    && parts[2] === "subtasks"
    && parts.length >= 5;
}

function proposeRename(rel) {
  const name = basename(rel);
  const base = name.slice(0, -3);
  let next = base;

  if (isSubtaskPath(rel) && /^ss-/iu.test(next)) {
    next = next.replace(/^ss-/iu, "");
  }

  if (!LOWERCASE_HYPHEN.test(next) && !ALL_CAPS_DOC.test(next)) {
    next = next
      .toLowerCase()
      .replace(/[\s_]+/gu, "-")
      .replace(/[^a-z0-9-]+/gu, "-")
      .replace(/-+/gu, "-")
      .replace(/^-|-$/gu, "");
  }

  const nextName = `${next}.md`;
  return nextName === name ? null : nextName;
}

function main() {
  const files = walk(ROOT);
  const plan = [];
  for (const rel of files) {
    const nextName = proposeRename(rel);
    if (!nextName) continue;
    const from = join(ROOT, rel);
    const to = join(ROOT, dirname(rel), nextName);
    if (existsSync(to)) {
      console.error(`[skip] target exists: ${to} (from ${from})`);
      continue;
    }
    plan.push({ from, to, rel, nextName });
  }

  if (plan.length === 0) {
    console.log("[fix-markdown-filenames] nothing to rename");
    return;
  }

  for (const item of plan) {
    console.log(`${DRY_RUN ? "[dry-run] " : ""}rename ${item.rel} -> ${dirname(item.rel)}/${item.nextName}`);
    if (!DRY_RUN) {
      renameSync(item.from, item.to);
    }
  }
  console.log(`[fix-markdown-filenames] ${plan.length} file(s) ${DRY_RUN ? "would be renamed" : "renamed"}`);
}

main();
