import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION_JSON = resolve(__dirname, "../version.json");

function main() {
  const { version } = JSON.parse(readFileSync(VERSION_JSON, "utf8"));
  if (version.endsWith("-dev")) {
    console.log(`[SKIP] Local dev version detected (${version}). Skipping remote tag check.`);
    process.exit(0);
  }

  const tagName = `v${version}`;
  console.log(`Checking for remote tag: ${tagName}`);

  try {
    const remoteTags = execSync("git ls-remote --tags origin", { encoding: "utf8" });
    if (!remoteTags.includes(`refs/tags/${tagName}`)) {
      console.error(`[FATAL] Expected release tag ${tagName} not found on remote 'origin'.`);
      console.error("Release builds MUST be tagged before they can be promoted to main.");
      process.exit(1);
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
