#!/usr/bin/env node
/**
 * check-prompt-loader-mocks.mjs
 *
 * CI guard: every `vi.mock('...prompt-loader', ...)` in the macro-controller
 * test tree MUST route through `buildPromptLoaderMock()` (see
 * `standalone-scripts/macro-controller/src/__tests__/helpers/prompt-loader-mock.ts`).
 *
 * Rationale (v4.187.0 incident): direct inline mocks routinely omit the
 * `sendToExtension` export that `runSql` reads via a getter, causing vitest
 * to throw "No 'sendToExtension' export is defined on the mock". Routing
 * through the shared factory guarantees the export is present even when a
 * test overrides other symbols.
 *
 * Exit codes:
 *   0 - all prompt-loader mocks route through buildPromptLoaderMock()
 *   1 - one or more offenders detected (paths + line numbers printed)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = [
    'standalone-scripts/macro-controller/src',
    'standalone-scripts/macro-controller/tests',
];

function collectTestFiles(dir, acc = []) {
    let entries;
    try { entries = readdirSync(dir); } catch { return acc; }
    for (const name of entries) {
        if (name === 'node_modules' || name === 'dist') continue;
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) { collectTestFiles(full, acc); continue; }
        if (/\.(test|spec)\.tsx?$/.test(name)) acc.push(full);
    }
    return acc;
}

/**
 * Extract a `vi.mock(...)` call ending in the matching close-paren, using a
 * simple paren/brace/string counter. Returns the full block text and end index.
 */
function extractCallBlock(src, startIdx) {
    // startIdx points at the `(` opening vi.mock's argument list.
    let i = startIdx;
    let depth = 0;
    let inStr = null; // '\'' | '"' | '`' | null
    let esc = false;
    for (; i < src.length; i++) {
        const c = src[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === '\'' || c === '"' || c === '`') { inStr = c; continue; }
        if (c === '(' || c === '{' || c === '[') depth++;
        else if (c === ')' || c === '}' || c === ']') { depth--; if (depth === 0 && c === ')') return { end: i, block: src.slice(startIdx, i + 1) }; }
    }
    return null;
}

const offenders = [];
for (const rel of SCAN_ROOTS) {
    const files = collectTestFiles(join(ROOT, rel));
    for (const file of files) {
        const src = readFileSync(file, 'utf8');
        const re = /vi\.mock\s*\(/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            const parenIdx = m.index + m[0].length - 1; // index of '('
            const extracted = extractCallBlock(src, parenIdx);
            if (!extracted) continue;
            const block = extracted.block;
            if (!/['"][^'"]*prompt-loader['"]/.test(block)) continue;
            if (/buildPromptLoaderMock\s*\(/.test(block)) continue;
            const lineNo = src.slice(0, m.index).split('\n').length;
            offenders.push({ file: relative(ROOT, file), line: lineNo });
        }
    }
}

if (offenders.length > 0) {
    console.error('[check-prompt-loader-mocks] FAIL: direct vi.mock() of prompt-loader detected.');
    console.error('Route these mocks through buildPromptLoaderMock() from');
    console.error('  standalone-scripts/macro-controller/src/__tests__/helpers/prompt-loader-mock.ts');
    console.error('');
    for (const o of offenders) console.error(`  - ${o.file}:${o.line}`);
    console.error('');
    console.error(`Total offenders: ${offenders.length}`);
    process.exit(1);
}
console.log('[check-prompt-loader-mocks] OK: all prompt-loader mocks use buildPromptLoaderMock().');
