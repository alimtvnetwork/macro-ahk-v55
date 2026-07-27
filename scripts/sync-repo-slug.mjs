#!/usr/bin/env node
/**
 * sync-repo-slug.mjs
 *
 * Auto-heal step for repo rename / fork. Called from
 * `.github/workflows/release.yml` (job `setup`) BEFORE
 * `check-installer-contract.mjs` runs.
 *
 * Rewrites, in place, every hardcoded `alimtvnetwork/macro-ahk-v*` and
 * `aukgit/macro-ahk-v*` literal in the installer scripts to the value
 * returned by `resolveRepoSlug()`. Idempotent.
 *
 * See .lovable/memory/features/release-pipeline-repo-url-agnostic.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRepoSlug } from "./resolve-repo-slug.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_LITERAL_RE = /(alimtvnetwork|aukgit)\/macro-ahk-v\d+/g;

const targets = [
    "installer-contract.json",
    "installer-constants.sh",
    "installer-constants.ps1",
    "install.sh",
    "install.ps1",
    "clone-repo.ps1",
    "download-extension.ps1",
    "clone-ahk.mjs",
];

const contract = JSON.parse(
    readFileSync(join(__dirname, "installer-contract.json"), "utf8"),
);
const { slug, source } = resolveRepoSlug({ fallback: contract.repo.fallback });

let changed = 0;
for (const filename of targets) {
    const filePath = join(__dirname, filename);
    let contents;
    try {
        contents = readFileSync(filePath, "utf8");
    } catch {
        continue;
    }
    const next = contents.replace(REPO_LITERAL_RE, slug);
    if (next !== contents) {
        writeFileSync(filePath, next, "utf8");
        changed += 1;
        process.stdout.write(`  rewrote ${filename}\n`);
    }
}

process.stdout.write(
    `sync-repo-slug: slug=${slug} source=${source} files-changed=${changed}\n`,
);