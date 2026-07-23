#!/usr/bin/env node
/**
 * check-em-dash-in-failure-reports.mjs
 *
 * Companion to `check-em-dash-in-tests.mjs`. Forbids U+2014 (em-dash) and
 * U+2013 (en-dash) inside *code* content (string literals, template strings,
 * identifiers) of the source files that BUILD or EMIT failure reports and
 * failure UI. Doc comments (JSDoc, block, and single-line `//`) are exempt
 * so historical prose stays intact.
 *
 * Why: mem://preferences/no-em-dash-in-output and Plan 10 Step 5 mandate
 * ASCII-only failure report bodies. The tests-only checker prevented drift
 * between failing tests and emitters; this checker prevents an emitter from
 * regressing directly (e.g., a toast message, a Reason string, an adapter
 * line) even when the test file remains ASCII.
 *
 * Scope: an explicit allow-list of emitter files under
 *   - src/background/recorder/{failure-logger,js-step-diagnostics,
 *     condition-failure-*,instruction-failure-adapters,selector-attempt-evaluator,
 *     selector-comparison,drift-element-diff}.ts
 *   - src/components/recorder/failure-toast.ts
 *
 * Exit codes:
 *   0 - clean
 *   1 - one or more offending code lines found (prints file:line and content)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const FORBIDDEN = /[\u2013\u2014]/;

const TARGETS = [
    "src/background/recorder/failure-logger.ts",
    "src/background/recorder/js-step-diagnostics.ts",
    "src/background/recorder/condition-failure-flatten.ts",
    "src/background/recorder/condition-failure-record.ts",
    "src/background/recorder/instruction-failure-adapters.ts",
    "src/background/recorder/selector-attempt-evaluator.ts",
    "src/background/recorder/selector-comparison.ts",
    "src/background/recorder/drift-element-diff.ts",
    "src/background/recorder/retry-step.ts",
    "src/components/recorder/failure-toast.ts",
    "standalone-scripts/macro-controller/src/startup.ts",
    "standalone-scripts/macro-controller/src/startup-idempotent-check.ts",
];

function scanFile(absPath) {
    const source = readFileSync(absPath, "utf8");
    const lines = source.split(/\r?\n/);
    const hits = [];
    let inBlock = false;

    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i];
        let content = raw;

        if (inBlock) {
            const endIdx = content.indexOf("*/");
            if (endIdx === -1) { continue; }
            content = content.slice(endIdx + 2);
            inBlock = false;
        }
        while (true) {
            const openIdx = content.indexOf("/*");
            if (openIdx === -1) { break; }
            const closeIdx = content.indexOf("*/", openIdx + 2);
            if (closeIdx === -1) {
                content = content.slice(0, openIdx);
                inBlock = true;
                break;
            }
            content = content.slice(0, openIdx) + content.slice(closeIdx + 2);
        }

        const slashIdx = content.indexOf("//");
        if (slashIdx !== -1) { content = content.slice(0, slashIdx); }

        if (/^\s*\*/.test(content)) { continue; }

        if (FORBIDDEN.test(content)) {
            hits.push({ line: i + 1, text: raw.trimEnd() });
        }
    }
    return hits;
}

function main() {
    let offenders = 0;
    let scanned = 0;
    for (const rel of TARGETS) {
        const abs = resolve(ROOT, rel);
        if (!existsSync(abs)) { continue; }
        scanned += 1;
        const hits = scanFile(abs);
        for (const hit of hits) {
            offenders += 1;
            console.error(`${relative(ROOT, abs)}:${hit.line}: ${hit.text}`);
        }
    }
    if (offenders > 0) {
        console.error(
            `\ncheck-em-dash-in-failure-reports: FAIL (${offenders} offender(s) `
            + `across ${scanned} file(s)). Replace em-dash (U+2014) / en-dash `
            + `(U+2013) in code content with ASCII (",", ":", "-").`,
        );
        process.exit(1);
    }
    console.log(`check-em-dash-in-failure-reports: OK (scanned ${scanned} file(s), 0 offenders)`);
}

main();
