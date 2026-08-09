#!/usr/bin/env node
/**
 * check-release-assets.mjs
 *
 * Post-publish gate for `.github/workflows/release.yml`.
 *
 * Every release from v5.9.0 through v5.22.0 published a release PAGE with
 * ZERO assets while the workflow reported nothing at all (the run had a YAML
 * startup failure, so no job ever ran). Nothing in the pipeline asserted that
 * the finished release actually carries the built Chrome extension and the
 * prompts bundle, so the gap stayed invisible for 14 releases.
 *
 * This script queries the published release for the tag and fails when a
 * required asset is missing or smaller than its size floor.
 *
 * Env:
 *   RELEASE_TAG       required, for example v5.27.0
 *   GITHUB_REPOSITORY required, owner/repo
 *   GITHUB_TOKEN      optional, raises the API rate limit
 *
 * Run: RELEASE_TAG=v5.27.0 node scripts/check-release-assets.mjs
 */

import { appendFileSync } from "node:fs";

/** Required asset name templates and their minimum acceptable byte size. */
const REQUIRED_ASSETS = [
    { template: "marco-extension-${TAG}.zip", minBytes: 500 * 1024 },
    { template: "prompts-${TAG}.zip", minBytes: 10 * 1024 },
    { template: "macro-controller-${TAG}.zip", minBytes: 100 * 1024 },
    { template: "marco-sdk-${TAG}.zip", minBytes: 5 * 1024 },
    { template: "xpath-${TAG}.zip", minBytes: 1024 },
    { template: "install.ps1", minBytes: 1024 },
    { template: "install.sh", minBytes: 1024 },
    { template: "checksums.txt", minBytes: 64 },
    { template: "VERSION.txt", minBytes: 2 },
];

/** Append a line to the GitHub Actions job summary when running in CI. */
function writeStepSummary(line) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;
    appendFileSync(summaryPath, `${line}\n`, "utf8");
}

/** Fetch the published release payload for a tag. */
async function fetchRelease(slug, tag) {
    const headers = { Accept: "application/vnd.github+json" };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`https://api.github.com/repos/${slug}/releases/tags/${tag}`, { headers });
    if (!response.ok) {
        const details = await response.text();
        throw new Error(`GitHub API ${response.status} for /repos/${slug}/releases/tags/${tag}: ${details}`);
    }
    return response.json();
}

/** Compare published assets against the required list. Returns failure strings. */
export function findMissingAssets(assets, tag) {
    const bySize = new Map(assets.map(asset => [asset.name, asset.size]));
    const failures = [];
    for (const required of REQUIRED_ASSETS) {
        const name = required.template.replace("${TAG}", tag);
        if (!bySize.has(name)) {
            failures.push(`${name} is MISSING from the release`);
            continue;
        }
        const size = bySize.get(name);
        if (size < required.minBytes) {
            failures.push(`${name} is ${size} bytes, below the ${required.minBytes} byte floor`);
        }
    }
    return failures;
}

async function main() {
    const tag = process.env.RELEASE_TAG;
    const slug = process.env.GITHUB_REPOSITORY;
    if (!tag) {
        console.error("[FATAL] RELEASE_TAG is not set. Expected the published tag, for example v5.27.0.");
        process.exit(1);
    }
    if (!slug) {
        console.error("[FATAL] GITHUB_REPOSITORY is not set. Expected owner/repo.");
        process.exit(1);
    }

    const release = await fetchRelease(slug, tag);
    const assets = Array.isArray(release.assets) ? release.assets : [];
    console.log(`Release ${tag} publishes ${assets.length} assets.`);
    for (const asset of assets) console.log(`  - ${asset.name} (${asset.size} bytes)`);

    const failures = findMissingAssets(assets, tag);
    if (failures.length > 0) {
        for (const failure of failures) console.error(`::error::${failure}`);
        writeStepSummary(
            `> [!CAUTION] Release \`${tag}\` is incomplete:\n${failures.map(line => `> - ${line}`).join("\n")}`,
        );
        process.exit(1);
    }

    console.log(`[OK] Release ${tag} carries every required asset.`);
    writeStepSummary(`> [!NOTE] Release \`${tag}\` verified: ${assets.length} assets, extension and prompts bundles present.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
    main().catch(error => {
        console.error(`[FAIL] check-release-assets: ${error.message}`);
        process.exit(1);
    });
}
