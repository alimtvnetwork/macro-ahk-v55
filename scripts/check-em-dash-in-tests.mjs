#!/usr/bin/env node
/**
 * check-em-dash-in-tests.mjs
 *
 * Forbids U+2014 (em-dash) and U+2013 (en-dash) inside *assertion* content
 * in Vitest test files. Doc comments (JSDoc, block comments, and single-line
 * `//` comments) are ignored so historical prose is not disturbed.
 *
 * Why: format drift bugs (e.g. the JsThrew and ZeroMatches Reason lines)
 * kept slipping past review because a test file's string literals contained
 * em-dashes that matched incorrect emitter output. If the emitter is ASCII
 * (see `mem://preferences/no-em-dash-in-output` and the LOG-format-3 test),
 * tests must be ASCII too.
 *
 * Scope: `src/**\/*.{test,spec}.{ts,tsx,js,jsx,mjs}`.
 *
 * Exit codes:
 *   0 - clean
 *   1 - one or more offending lines found (prints file:line and content)
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

/**
 * Node-20 compatible replacement for `fs.globSync` (added in Node 22).
 * Walks `src/` recursively and returns paths matching test/spec suffixes.
 */
function collectTestFiles(root) {
    const results = [];
    const suffixes = [".test.ts", ".test.tsx", ".test.js", ".test.jsx", ".test.mjs", ".spec.ts", ".spec.tsx"];
    const stack = [join(root, "src")];
    while (stack.length > 0) {
        const dir = stack.pop();
        let entries;
        try { entries = readdirSync(dir, { withFileTypes: true }); }
        catch { continue; }
        for (const entry of entries) {
            const abs = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
                stack.push(abs);
            } else if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) {
                results.push(abs);
            }
        }
    }
    return results;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const FORBIDDEN = /[\u2013\u2014]/;

function scanFile(absPath) {
    const source = readFileSync(absPath, "utf8");
    const lines = source.split(/\r?\n/);
    const hits = [];
    let inBlock = false;

    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i];
        let content = raw;

        // Strip block comments (/* ... */) even when they span lines.
        if (inBlock) {
            const endIdx = content.indexOf("*/");
            if (endIdx === -1) { continue; }
            content = content.slice(endIdx + 2);
            inBlock = false;
        }
        // Handle further block-comment openings on the same line.
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

        // Strip single-line `//` comments (naive but sufficient here).
        const slashIdx = content.indexOf("//");
        if (slashIdx !== -1) { content = content.slice(0, slashIdx); }

        // Strip JSDoc continuation lines (` * ...`).
        if (/^\s*\*/.test(content)) { continue; }

        if (FORBIDDEN.test(content)) {
            hits.push({ line: i + 1, text: raw.trimEnd() });
        }
    }
    return hits;
}

function main() {
    const files = new Set(collectTestFiles(ROOT));


    const offenders = [];
    for (const file of files) {
        const hits = scanFile(file);
        if (hits.length > 0) {
            offenders.push({ file, hits });
        }
    }

    if (offenders.length === 0) {
        console.log(`[check-em-dash-in-tests] OK: scanned ${files.size} file(s), 0 offenders.`);
        process.exit(0);
    }

    console.error(`[check-em-dash-in-tests] FAIL: em-dash / en-dash found in ${offenders.length} file(s).`);
    console.error("These characters (U+2014, U+2013) must not appear in test-file code or assertions.");
    console.error("Use ',' or ':' instead. Doc comments are exempt.\n");
    for (const { file, hits } of offenders) {
        const rel = file.replace(ROOT + "/", "");
        for (const hit of hits) {
            console.error(`${rel}:${hit.line}: ${hit.text}`);
        }
    }
    process.exit(1);
}

main();
