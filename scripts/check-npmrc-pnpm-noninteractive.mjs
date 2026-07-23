#!/usr/bin/env node
/**
 * CI guard: ensures pnpm-config.ps1 emits the .npmrc keys that prevent
 * pnpm v9+ from triggering ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
 * during nested `pnpm run` calls (e.g. build:macro-controller -> build:prompts).
 *
 * Required keys in EVERY .npmrc branch:
 *   - verify-deps-before-run=false   (skip the auto-reinstall check)
 *   - confirm-modules-purge=false    (don't prompt for TTY confirmation)
 */
import { readFileSync } from "node:fs";

const TARGET = "scripts/ps-modules/pnpm-config.ps1";
const REQUIRED = ["verify-deps-before-run=false", "confirm-modules-purge=false", "strict-dep-builds=false"];
const FORBIDDEN = ["dangerouslyAllowAllBuilds", "dangerously-allow-all-builds"];
const text = readFileSync(TARGET, "utf-8");
const missing = REQUIRED.filter((key) => !text.includes(key));
const forbiddenFound = FORBIDDEN.filter((key) => text.includes(key));
if (forbiddenFound.length > 0) {
    console.error("[FAIL] " + TARGET + " contains keys that conflict with package.json -> pnpm.onlyBuiltDependencies:");
    for (const key of forbiddenFound) console.error("  - " + key);
    console.error("Reason: pnpm aborts with ERR_PNPM_CONFIG_CONFLICT_BUILT_DEPENDENCIES.");
    process.exit(1);
}

if (missing.length > 0) {
    console.error("[FAIL] " + TARGET + " is missing pnpm non-interactive keys:");
    for (const key of missing) console.error("  - " + key);
    console.error("Reason: nested `pnpm run` invocations crash on Windows without these keys (no TTY).");
    process.exit(1);
}

console.log("[OK] pnpm-config.ps1 emits non-interactive .npmrc keys");

const UTILS_TARGET = "scripts/ps-modules/utils.ps1";
const utilsText = readFileSync(UTILS_TARGET, "utf-8");
const requiredEnv = [
    "Set-PnpmNonInteractiveEnvironment",
    "pnpm_config_$name",
    "npm_config_$name",
    "verify_deps_before_run",
];
const missingEnv = requiredEnv.filter((key) => !utilsText.includes(key));
if (missingEnv.length > 0) {
    console.error("[FAIL] " + UTILS_TARGET + " is missing inherited pnpm environment safeguards:");
    for (const key of missingEnv) console.error("  - " + key);
    console.error("Reason: pnpm v10/v11 child install checks may ignore command flags but inherit pnpm_config_*.");
    process.exit(1);
}

console.log("[OK] utils.ps1 exports pnpm non-interactive environment safeguards");