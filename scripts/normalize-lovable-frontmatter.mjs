#!/usr/bin/env node
// Adds minimal frontmatter to .lovable/{plans,issues,spec/commands} files when missing.
// Non-destructive: only prepends a fenced block above the first heading if none of
// Slug/Status/Created is present in the first 10 lines. Idempotent.

import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { execSync } from "node:child_process";

// Node-20 compatible replacement for `fs.globSync` (added in Node 22).
// Supports the exact patterns used by TARGETS: "<dir>/*.md" and "<dir>/[0-9]*.md".
function globDir(pattern) {
  const lastSlash = pattern.lastIndexOf("/");
  const dir = pattern.slice(0, lastSlash);
  const fileGlob = pattern.slice(lastSlash + 1);
  if (!existsSync(dir)) return [];
  const numericPrefix = fileGlob.startsWith("[0-9]");
  const suffix = numericPrefix ? fileGlob.slice("[0-9]".length).replace(/^\*/, "") : fileGlob.replace(/^\*/, "");
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix) && (!numericPrefix || /^\d/.test(name)))
    .map((name) => join(dir, name));
}

const TARGETS = [
  { glob: ".lovable/plans/pending/*.md", status: "pending" },
  { glob: ".lovable/plans/completed/*.md", status: "completed" },
  { glob: ".lovable/issues/open/*.md", status: "open" },
  { glob: ".lovable/issues/closed/*.md", status: "closed" },
  { glob: ".lovable/spec/commands/[0-9]*.md", status: "active" },
];

const KEYS = /^(Slug|Status|Created)\s*:/im;
let touched = 0;
let scanned = 0;

for (const t of TARGETS) {
  const files = globDir(t.glob);
  for (const f of files) {
    scanned++;
    if (basename(f).toLowerCase() === "readme.md") continue;
    const raw = readFileSync(f, "utf8");
    const head = raw.split("\n").slice(0, 12).join("\n");
    if (KEYS.test(head)) continue;
    const slug = basename(f, ".md").replace(/^\d+-/, "");
    const mtime = statSync(f).mtime.toISOString().slice(0, 10);
    const fm = `Slug: ${slug}\nStatus: ${t.status}\nCreated: ${mtime}\n\n`;
    writeFileSync(f, fm + raw);
    touched++;
  }
}
console.log(`frontmatter-normalize: scanned=${scanned} touched=${touched}`);
