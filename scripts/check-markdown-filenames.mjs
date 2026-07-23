#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = process.argv[2] ?? ".";
const EXCLUDED_DIRS = new Set([".git", "node_modules", "skipped", ".release"]);
const LOWERCASE_HYPHEN = /^[a-z0-9][a-z0-9-]*$/u;
const ALL_CAPS_DOC = /^[A-Z0-9][A-Z0-9_-]*$/u;
const SUBTASK_SEQUENCE_FIRST = /^[0-9]{2}[a-z]?-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const STALE_SUBTASK_PATH_REF = /\.lovable\/plans\/subtasks\/[^\s`)]+\/(?:ss|SS)-[0-9][^\s`)]*\.md|\.\/subtasks\/[^\s`)]+\/(?:ss|SS)-[0-9][^\s`)]*\.md/gu;

function collectMarkdownFiles(directory, prefix = "") {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        files.push(...collectMarkdownFiles(join(directory, entry.name), relativePath));
      }
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(relativePath);
    }
  }
  return files;
}

function isLovableSubtaskFile(relativePath, baseName) {
  const parts = relativePath.split("/");
  return parts[0] === ".lovable"
    && parts[1] === "plans"
    && parts[2] === "subtasks"
    && parts.length >= 5
    && baseName !== "readme";
}

function validateMarkdownFile(relativePath) {
  const fileName = basename(relativePath);
  const extensionIsLowercase = fileName.endsWith(".md");
  const baseName = fileName.slice(0, -3);
  const violations = [];

  if (!extensionIsLowercase) {
    violations.push("extension must be lowercase .md");
  }
  if (!LOWERCASE_HYPHEN.test(baseName) && !ALL_CAPS_DOC.test(baseName)) {
    violations.push("use lowercase hyphen-case or ALL-CAPS markdown filenames");
  }
  if (isLovableSubtaskFile(relativePath, baseName)) {
    if (/^ss-/iu.test(baseName)) {
      violations.push("subtask filenames must start with the numeric sequence, not ss-");
    } else if (!SUBTASK_SEQUENCE_FIRST.test(baseName)) {
      violations.push("subtask filenames must start with the numeric sequence, for example 01-scope.md");
    }
  }
  return violations.map((reason) => ({ file: relativePath, reason }));
}

function validateMarkdownContent(relativePath) {
  const absolutePath = join(ROOT, relativePath);
  const content = readFileSync(absolutePath, "utf8");
  const violations = [];
  for (const match of content.matchAll(STALE_SUBTASK_PATH_REF)) {
    violations.push({
      file: relativePath,
      reason: `stale subtask path reference uses ${match[0].includes("/SS-") ? "SS-" : "ss-"}; use the numeric sequence filename`,
    });
  }
  return violations;
}

const markdownFiles = collectMarkdownFiles(ROOT);
const violations = markdownFiles.flatMap((relativePath) => [
  ...validateMarkdownFile(relativePath),
  ...validateMarkdownContent(relativePath),
]);

if (violations.length > 0) {
  process.stderr.write("Markdown filename policy failed:\n");
  for (const violation of violations) {
    process.stderr.write(`::error file=${violation.file}::${violation.reason}\n`);
  }
  process.exit(1);
}

process.stdout.write("Markdown filename policy OK\n");