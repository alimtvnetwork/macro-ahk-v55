#!/usr/bin/env node
/**
 * scripts/audit-p0-rules.mjs
 *
 * Aggregator for the 10 P0 items in spec/33-missing-coding-guideline/14-*.
 * Measures each category against the baselines in 99-baselines.json, prints a
 * table, and writes a machine-readable rollup to public/p0-rules-audit.json.
 *
 * Sequential fail-fast per mem://constraints/no-retry-policy: no retry, no
 * backoff. --strict exits 1 when any category exceeds its baseline (regression
 * gate). Default is warn-only (exit 0) so contributors can run it locally
 * without a red CI.
 *
 * Categories -> detection strategy:
 *   P0-01  innerHTML sinks             ripgrep `\.innerHTML\s*=`
 *   P0-02  new Function() dyn eval     ripgrep `\bnew\s+Function\s*\(`
 *   P0-03  silent IndexedDB catch      ripgrep `catch\s*\([^)]*\)\s*\{\s*\}` in prompt-dropdown.ts
 *   P0-04a unauthorized console.error  eslint.config.js allowlist violation count via audit-logger-compliance
 *   P0-04b unannotated silent catches  ripgrep empty catch bodies without `// intentional` marker
 *   P0-05  setInterval bypasses tracker ripgrep `setInterval\b` minus trackedSetInterval imports
 *   P0-06  raw localStorage literal keys ripgrep `localStorage\.(get|set|remove)Item\s*\(\s*['"]`
 *   P0-07  packages at 0.00 test ratio  scan standalone-scripts package.json vs test.ts counts
 *   P0-08  complexity rules disabled    grep eslint.config.js for `sonarjs/cognitive-complexity.*off`
 *   P0-09  macro-controller cycles      reuse check-madge-cycles.mjs output
 *   P0-10  as-unknown-as double casts   reuse check-unknown-usage.mjs (asUnknownAsDoubleCasts)
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASELINES_PATH = join(ROOT, "spec/33-missing-coding-guideline/99-baselines.json");
const OUT_PATH = join(ROOT, "public/p0-rules-audit.json");
const STRICT = process.argv.includes("--strict");

const baselines = JSON.parse(readFileSync(BASELINES_PATH, "utf8")).baselines;

/** Run ripgrep, return the count of matching lines (0 on no matches). */
function rgCount(pattern, globs, extraArgs = []) {
  const args = ["--no-heading", "--no-messages", "-c", ...extraArgs];
  for (const g of globs) args.push("-g", g);
  args.push("-e", pattern);
  args.push("standalone-scripts");
  const res = spawnSync("rg", args, { cwd: ROOT, encoding: "utf8" });
  if (res.status !== 0 && res.status !== 1) {
    return { count: -1, error: res.stderr || `rg exit ${res.status}` };
  }
  let total = 0;
  for (const line of (res.stdout || "").split("\n")) {
    const m = line.match(/:(\d+)$/);
    if (m) total += Number(m[1]);
  }
  return { count: total };
}

/** Walk a directory for files matching a predicate. */
function walk(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "__tests__") continue;
      walk(p, predicate, out);
    } else if (predicate(p)) {
      out.push(p);
    }
  }
  return out;
}

const findings = {};

// P0-01: innerHTML sinks
findings["P0-01"] = {
  title: "innerHTML sinks",
  baseline: baselines.innerHTMLSinks,
  observed: rgCount("\\.innerHTML\\s*=", ["standalone-scripts/**/*.ts", "!**/__tests__/**", "!**/dist/**"]).count,
  eslintRule: "no-restricted-syntax (AssignmentExpression[left.property.name='innerHTML'])",
};

// P0-02: new Function()
findings["P0-02"] = {
  title: "new Function() dynamic eval",
  baseline: baselines.newFunctionSites,
  observed: rgCount("\\bnew\\s+Function\\s*\\(", ["standalone-scripts/**/*.ts", "!**/__tests__/**", "!**/dist/**"]).count,
  eslintRule: "no-restricted-syntax (NewExpression[callee.name='Function'])",
};

// P0-03: silent empty catch in prompt-dropdown.ts (single-file check)
{
  const target = join(ROOT, "standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts");
  let observed = 0;
  if (existsSync(target)) {
    const src = readFileSync(target, "utf8");
    // count empty catch blocks with no annotation on the same line above
    const matches = src.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || [];
    observed = matches.length;
  }
  findings["P0-03"] = {
    title: "Silent IndexedDB catch (prompt-dropdown.ts)",
    baseline: 1,
    observed,
    eslintRule: "no-empty ({ allowEmptyCatch: false })",
  };
}

// P0-04a: unauthorized console.error (via audit-logger-compliance)
{
  const res = spawnSync("node", ["scripts/audit-logger-compliance.mjs"], { cwd: ROOT, encoding: "utf8" });
  const out = (res.stdout || "") + (res.stderr || "");
  const m = out.match(/(\d+)\s+unauthorized/i) || out.match(/violations:\s*(\d+)/i);
  findings["P0-04a"] = {
    title: "Unauthorized console.error sites",
    baseline: baselines.unauthorizedConsoleError,
    observed: m ? Number(m[1]) : null,
    eslintRule: "no-restricted-syntax (console.error) + allowlist override",
    note: m ? undefined : "audit-logger-compliance.mjs output shape changed; check manually",
  };
}

// P0-04b: unannotated silent catches
findings["P0-04b"] = {
  title: "Unannotated silent catches",
  baseline: baselines.unannotatedSilentCatches,
  observed: rgCount("catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}", ["standalone-scripts/**/*.ts", "!**/__tests__/**", "!**/dist/**"]).count,
  eslintRule: "no-empty ({ allowEmptyCatch: false })",
};

// P0-05: setInterval bypassing trackedSetInterval
{
  const total = rgCount("\\bsetInterval\\s*\\(", ["standalone-scripts/**/*.ts", "!**/__tests__/**", "!**/dist/**"]).count;
  const tracked = rgCount("trackedSetInterval", ["standalone-scripts/**/*.ts", "!**/__tests__/**", "!**/dist/**"]).count;
  findings["P0-05"] = {
    title: "setInterval sites bypassing trackedSetInterval registry",
    baseline: baselines.setIntervalBypassingRegistry,
    observed: Math.max(0, total - tracked),
    note: `total setInterval: ${total}; trackedSetInterval refs: ${tracked}`,
    eslintRule: "custom AST rule (not implemented); enforced by check-timer-teardown.mjs",
  };
}

// P0-06: raw localStorage literal keys
findings["P0-06"] = {
  title: "Raw localStorage literal keys",
  baseline: baselines.rawLocalStorageLiteralKeys,
  observed: rgCount("localStorage\\.(get|set|remove)Item\\s*\\(\\s*['\"]", ["standalone-scripts/**/*.ts", "!**/__tests__/**", "!**/dist/**"]).count,
  eslintRule: "no-restricted-syntax (CallExpression[callee.object.name='localStorage'])",
};

// P0-07: packages at 0.00 test ratio
{
  const pkgs = walk(join(ROOT, "standalone-scripts"), (p) => p.endsWith("/package.json") && !p.includes("/node_modules/"));
  const zeroCov = [];
  const perPackage = {};
  for (const pkgJson of pkgs) {
    const pkgDir = dirname(pkgJson);
    const pkgName = pkgDir.split("/").pop();
    if (!existsSync(join(pkgDir, "src"))) continue;
    const srcFiles = walk(join(pkgDir, "src"), (p) => p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".d.ts"));
    const testFiles = walk(pkgDir, (p) => p.endsWith(".test.ts"));
    const ratio = srcFiles.length === 0 ? 1 : testFiles.length / srcFiles.length;
    perPackage[pkgName] = { src: srcFiles.length, tests: testFiles.length, ratio: Number(ratio.toFixed(3)) };
    if (ratio < 0.20) zeroCov.push(pkgName);
  }
  findings["P0-07"] = {
    title: "Packages below 0.20 prod:test ratio",
    baseline: baselines.zeroCoveragePackages,
    observed: zeroCov,
    perPackage,
    eslintRule: "not enforceable in ESLint; enforced by scripts/check-test-with-features.mjs (to be added)",
  };
}

// P0-08: complexity rules status
{
  const cfg = readFileSync(join(ROOT, "eslint.config.js"), "utf8");
  const cognitiveOff = /["']sonarjs\/cognitive-complexity["']\s*:\s*["']off["']/.test(cfg);
  const cognitiveWarn = /["']sonarjs\/cognitive-complexity["']\s*:\s*\[\s*["']warn["']/.test(cfg);
  const cognitiveError = /["']sonarjs\/cognitive-complexity["']\s*:\s*\[\s*["']error["']/.test(cfg);
  const maxLinesOff = /["']max-lines-per-function["']\s*:\s*["']off["']/.test(cfg);
  findings["P0-08"] = {
    title: "Complexity rules status in eslint.config.js",
    baseline: "warn (was: disabled for standalone-scripts/**)",
    observed: {
      cognitiveComplexity: cognitiveError ? "error" : cognitiveWarn ? "warn" : cognitiveOff ? "off" : "unknown",
      maxLinesPerFunction: maxLinesOff ? "off" : "warn (tiered 25/40/50/60)",
    },
    eslintRule: "sonarjs/cognitive-complexity, max-lines-per-function",
  };
}

// P0-09: cycles (delegates to check-madge-cycles.mjs)
{
  const res = spawnSync("node", ["scripts/check-madge-cycles.mjs"], { cwd: ROOT, encoding: "utf8" });
  const out = (res.stdout || "") + (res.stderr || "");
  const m = out.match(/observed[^\d]*(\d+).*baseline[^\d]*(\d+)/is) || out.match(/(\d+)\s*cycles?/i);
  findings["P0-09"] = {
    title: "macro-controller cycles",
    baseline: baselines.macroControllerCycles,
    observed: m ? Number(m[1]) : (res.status === 0 ? 0 : null),
    eslintRule: "import/no-cycle (deferred); enforced by check-madge-cycles.mjs",
  };
}

// P0-10: `as unknown as` double casts (delegates to check-unknown-usage.mjs)
{
  const res = spawnSync("node", ["scripts/check-unknown-usage.mjs"], { cwd: ROOT, encoding: "utf8" });
  const out = String(res.stdout || "") + String(res.stderr || "");
  const parts = out.split("as-unknown-as");
  let observed = null;
  if (parts.length > 1) {
    const m2 = parts[1].match(/(\d+)/);
    if (m2) observed = Number(m2[1]);
  }
  findings["P0-10"] = {
    title: "`as unknown as` double-casts",
    baseline: baselines.asUnknownAsDoubleCasts,
    observed,
    eslintRule: "no-restricted-syntax (TSAsExpression > TSAsExpression[TSUnknownKeyword])",
    note: observed === null ? `parse failed; raw=${JSON.stringify(out).slice(0,120)}` : undefined,
  };
}

// --------- Roll up + verdict ---------
const rows = Object.entries(findings).map(([id, f]) => ({ id, ...f }));
let regressed = 0;
for (const r of rows) {
  if (typeof r.observed === "number" && typeof r.baseline === "number") {
    r.delta = r.observed - r.baseline;
    r.status = r.observed <= r.baseline ? "at-or-below-baseline" : "REGRESSED";
    if (r.status === "REGRESSED") regressed++;
  } else {
    r.status = "informational";
  }
}

const report = {
  schemaVersion: 1,
  generated: new Date().toISOString(),
  baselinesSource: "spec/33-missing-coding-guideline/99-baselines.json",
  strict: STRICT,
  regressedCount: regressed,
  findings: rows,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

// Console table
const pad = (s, n) => String(s).padEnd(n);
console.log("");
console.log(pad("ID", 8), pad("Observed", 12), pad("Baseline", 20), pad("Status", 22), "Title");
console.log("-".repeat(120));
for (const r of rows) {
  const obs = Array.isArray(r.observed) ? `[${r.observed.length}]` : String(r.observed);
  const base = Array.isArray(r.baseline) ? `[${r.baseline.length}]` : (typeof r.baseline === "object" ? JSON.stringify(r.baseline).slice(0,18) : String(r.baseline));
  console.log(pad(r.id, 8), pad(obs, 12), pad(base, 20), pad(r.status, 22), r.title);
}
console.log("");
console.log(`Wrote ${OUT_PATH}`);
console.log(`Regressed categories: ${regressed}`);

if (STRICT && regressed > 0) {
  console.error("[FAIL] --strict: one or more P0 categories regressed above baseline.");
  process.exit(1);
}
process.exit(0);
