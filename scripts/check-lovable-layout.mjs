#!/usr/bin/env node
// Layout guard for .lovable/. Fails if unknown top-level entries appear or
// required indexes are missing. Warn-only when --warn is passed.

import { readdirSync, existsSync } from "node:fs";

const ROOT = ".lovable";
const ALLOWED = new Set([
  "README.md", "MAP.md", "rules.md", "coding-guidelines.md", "plan.md",
  "prompt-mirrors.json",
  "plans", "issues", "spec", "memory", "audits", "cicd", "prompts",
  "question-and-ambiguity", "archive",
]);
const REQUIRED = [
  ".lovable/README.md",
  ".lovable/MAP.md",
  ".lovable/rules.md",
  ".lovable/plans/README.md",
  ".lovable/issues/README.md",
  ".lovable/spec/commands/README.md",
  ".lovable/memory/core.md",
];

const warnOnly = process.argv.includes("--warn");
const problems = [];

for (const name of readdirSync(ROOT)) {
  if (!ALLOWED.has(name)) problems.push(`unknown top-level entry: .lovable/${name}`);
}
for (const p of REQUIRED) {
  if (!existsSync(p)) problems.push(`missing required file: ${p}`);
}

if (problems.length === 0) {
  console.log("check-lovable-layout: OK");
  process.exit(0);
}
const tag = warnOnly ? "warn" : "error";
for (const p of problems) console.log(`check-lovable-layout ${tag}: ${p}`);
process.exit(warnOnly ? 0 : 1);
