#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = resolve(root, ".github/workflows");
const workflowFiles = readdirSync(workflowDir)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();

let failed = false;

for (const name of workflowFiles) {
  const path = resolve(workflowDir, name);
  const document = parseDocument(readFileSync(path, "utf8"), { prettyErrors: true });
  if (document.errors.length === 0) continue;

  failed = true;
  for (const error of document.errors) {
    const position = error.linePos?.[0];
    const line = position?.line ?? 1;
    const column = position?.col ?? 1;
    console.error(`::error file=.github/workflows/${name},line=${line},col=${column}::Invalid workflow YAML: ${error.message}`);
  }
}

if (failed) process.exit(1);
console.log(`[OK] Parsed ${workflowFiles.length} GitHub Actions workflow files.`);