#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_JSON_PATH = resolve(ROOT, "version.json");
const MANIFEST_PATH = resolve(ROOT, "manifest.json");
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function fail(title, exactPath, missing, reason) {
    console.error("");
    console.error("========================================");
    console.error("  [CODE RED] MANIFEST VERSION SYNC FAILED");
    console.error("========================================");
    console.error(`  Check:    ${title}`);
    console.error(`  Path:     ${exactPath}`);
    console.error(`  Missing:  ${missing}`);
    console.error(`  Reason:   ${reason}`);
    console.error("========================================");
    console.error("");
    process.exit(1);
}

function readJsonFile(filePath, label) {
    if (!existsSync(filePath)) {
        fail(
            `${label} existence`,
            filePath,
            `${label} file`,
            `The manifest version generator needs ${label} to derive the Chrome extension version from version.json.`,
        );
    }

    try {
        return JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (caught) {
        fail(
            `${label} JSON parse`,
            filePath,
            "Valid JSON content",
            `JSON.parse threw: ${caught instanceof Error ? caught.message : String(caught)}`,
        );
    }
}

function readCanonicalVersion() {
    const versionFile = readJsonFile(VERSION_JSON_PATH, "version.json");

    if (typeof versionFile.version !== "string" || !SEMVER_PATTERN.test(versionFile.version)) {
        fail(
            "version.json semver",
            VERSION_JSON_PATH,
            "version string matching X.Y.Z",
            `Current version value is ${JSON.stringify(versionFile.version)}.`,
        );
    }

    return versionFile.version;
}

function main() {
    const checkOnly = process.argv.includes("--check");
    const canonicalVersion = readCanonicalVersion();
    const manifest = readJsonFile(MANIFEST_PATH, "manifest.json");

    if (manifest.version === canonicalVersion) {
        console.log(`[OK] manifest.json version already matches version.json (${canonicalVersion})`);
        return;
    }

    if (checkOnly) {
        fail(
            "manifest.json version matches version.json",
            MANIFEST_PATH,
            `version ${canonicalVersion}`,
            `Current manifest version is ${JSON.stringify(manifest.version)}. Run node scripts/sync-manifest-version.mjs or pnpm run build:extension to regenerate it from version.json.`,
        );
    }

    manifest.version = canonicalVersion;
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 4)}\n`, "utf-8");
    console.log(`[OK] manifest.json version synced from version.json (${canonicalVersion})`);
}

main();