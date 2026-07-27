#!/usr/bin/env node
/**
 * write-version-from-tag.mjs
 *
 * The GIT TAG is the single source of truth for the release version.
 * version.json is a build-time artifact, not a hand-edited pin.
 *
 * This script resolves the current version and writes it into
 * root version.json so downstream readers (vite copy-manifest, sync-manifest-version,
 * check-built-manifest-csp, src/shared/version.ts, standalone-scripts/shared-version.ts,
 * etc.) all see the same value without changing their code.
 *
 * Resolution order:
 *   1. process.env.VERSION           (workflow-injected, tag-derived, no leading 'v')
 *   2. process.env.GITHUB_REF_NAME   (when GITHUB_REF_TYPE=tag, strip leading 'v')
 *   3. `git describe --tags --abbrev=0` on the current HEAD (strip leading 'v')
 *   4. Keep existing version.json.version if it's a valid semver
 *   5. Fallback: "0.0.0-dev"
 *
 * Never fails: local dev without tags falls through to 0.0.0-dev.
 *
 * See:
 *   - .lovable/spec/commands/05-tag-is-single-source-of-truth-for-version.md
 *   - .lovable/memory/features/release-pipeline-repo-url-agnostic.md
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const VERSION_JSON = resolve(ROOT, "version.json");
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+([.-].+)?$/;

function stripV(raw) {
    if (typeof raw !== "string") return null;
    const s = raw.trim().replace(/^v/, "");
    return SEMVER.test(s) ? s : null;
}

function fromGitDescribe() {
    try {
        const out = execSync("git describe --tags --abbrev=0", {
            cwd: ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        });
        return stripV(out);
    } catch {
        return null;
    }
}

function fromExisting() {
    if (!existsSync(VERSION_JSON)) return null;
    try {
        const j = JSON.parse(readFileSync(VERSION_JSON, "utf8"));
        return stripV(j.version);
    } catch {
        return null;
    }
}

function resolveVersion() {
    const env = process.env;
    const fromEnvVersion = stripV(env.VERSION);
    if (fromEnvVersion) return { version: fromEnvVersion, source: "env:VERSION" };

    if (env.GITHUB_REF_TYPE === "tag") {
        const fromRef = stripV(env.GITHUB_REF_NAME);
        if (fromRef) return { version: fromRef, source: "env:GITHUB_REF_NAME" };
    }
    const fromGit = fromGitDescribe();
    if (fromGit) return { version: fromGit, source: "git-describe" };

    const existing = fromExisting();
    if (existing && existing !== "0.0.0-dev") {
        return { version: existing, source: "existing-version.json" };
    }
    return { version: "0.0.0-dev", source: "fallback" };
}

const { version, source } = resolveVersion();

let existing = {};
if (existsSync(VERSION_JSON)) {
    try {
        existing = JSON.parse(readFileSync(VERSION_JSON, "utf8"));
    } catch {
        existing = {};
    }
}

const next = {
    ...existing,
    version,
    generatedFrom: source,
    generatedAt: new Date().toISOString(),
};
// Preserve non-version metadata that existed before.
if (!next.timezonePolicy) next.timezonePolicy = "UTC storage; user-local rendering";
if (!next.note) {
    next.note = "This file is a build-time artifact derived from the git tag by scripts/write-version-from-tag.mjs. The release version is the git tag (vX.Y.Z), not this file. Do not hand-edit the 'version' field.";
}

writeFileSync(VERSION_JSON, JSON.stringify(next, null, 2) + "\n", "utf8");
process.stdout.write(`write-version-from-tag: version=${version} source=${source}\n`);