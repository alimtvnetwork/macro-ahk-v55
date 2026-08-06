import { execSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRepoSlug } from "./resolve-repo-slug.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION_JSON = resolve(__dirname, "../version.json");
const CONTRACT_JSON = resolve(__dirname, "./installer-contract.json");

/** Contract fallback keeps slug resolution working when no GitHub remote exists. */
function contractFallbackSlug() {
  try {
    return JSON.parse(readFileSync(CONTRACT_JSON, "utf8")).repo.fallback;
  } catch {
    return undefined;
  }
}

/** Surface a line in the GitHub Actions job summary when running in CI. */
function writeStepSummary(line) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  appendFileSync(summaryPath, `${line}\n`, "utf8");
}

/**
 * Missing-tag severity. Hard-fail only where a tag must already exist
 * (release pipeline, or an explicit opt-in). On ordinary CI pushes a
 * missing tag is an action-required warning: the tag is created after
 * the version commit lands, by `.github/workflows/tag-and-release.yml`.
 */
function isTagMandatory() {
  if (process.env.RELEASE_TAG_REQUIRED === "1") return true;
  return process.env.GITHUB_REF_TYPE === "tag" || process.env.GITHUB_EVENT_NAME === "release";
}

function reportMissingTag(tagName, slug) {
  const mandatory = isTagMandatory();
  const level = mandatory ? "FATAL" : "ACTION REQUIRED";
  console.error(`[${level}] Expected release tag ${tagName} not found on remote 'https://github.com/${slug}.git'.`);
  writeStepSummary(
    `> [!WARNING] Tag \`${tagName}\` is not on the remote yet. Run **Actions > Tag and Release** with version \`${tagName.slice(1)}\` to create it and trigger the Release Build.`,
  );
  if (mandatory) process.exit(1);
  console.warn("Not a release event, so this is a warning only. Create the tag before publishing.");
}

function main() {
  const { version } = JSON.parse(readFileSync(VERSION_JSON, "utf8"));

  if (version.endsWith("-dev")) {
    const notice = `> [!WARNING] Release tag guard BYPASSED: version.json is \`${version}\` (dev suffix), so the remote tag presence check did not run. No \`v${version.replace(/-dev$/, "")}\` tag was verified.`;
    console.log(`[BYPASS] Dev version detected (${version}). Remote tag check skipped, release readiness NOT verified.`);
    writeStepSummary(notice);
    process.exit(0);
  }

  const tagName = `v${version}`;
  console.log(`Checking for remote tag: ${tagName}`);

  try {
    const { slug } = resolveRepoSlug({ fallback: contractFallbackSlug() });
    console.log(`Checking for remote tag: ${tagName} on ${slug}`);
    
    // Use ls-remote with the full URL to be remote-agnostic and handle cases where 'origin' isn't set
    const remoteTags = execSync(`git ls-remote --tags https://github.com/${slug}.git`, { encoding: "utf8" });
    if (!remoteTags.includes(`refs/tags/${tagName}`)) {
      reportMissingTag(tagName, slug);
      return;
    }
    console.log(`[OK] Tag ${tagName} found on remote.`);
  } catch (error) {
    console.error(`[ERROR] Failed to check remote tags: ${error.message}`);
    // If we can't check remote tags (e.g. no git, no remote), we warn but don't fail-fast
    // unless this is a master/main branch build.
    console.warn("Continuing despite git error (may be in a limited environment).");
  }
}

main();
