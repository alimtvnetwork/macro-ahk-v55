import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKER = resolve(fileURLToPath(new URL('../check-em-dash-in-tests.mjs', import.meta.url)));
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

function run(files) {
    const dir = mkdtempSync(join(tmpdir(), 'em-dash-guard-'));
    try {
        mkdirSync(join(dir, 'scripts'), { recursive: true });
        copyFileSync(CHECKER, join(dir, 'scripts/check-em-dash-in-tests.mjs'));
        for (const [path, content] of Object.entries(files)) {
            const target = join(dir, path);
            mkdirSync(resolve(target, '..'), { recursive: true });
            writeFileSync(target, content, 'utf8');
        }
        const result = spawnSync(process.execPath, ['scripts/check-em-dash-in-tests.mjs'], {
            cwd: dir, encoding: 'utf8',
        });
        return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('passes when no test files contain em/en-dashes in code', () => {
    const result = run({
        'src/example.test.ts': `describe("thing, subject", () => { it("works, ok", () => {}); });\n`,
    });
    assert.equal(result.code, 0, result.stderr);
});

test('fails when em-dash appears in an assertion string', () => {
    const result = run({
        'src/example.test.ts': `expect(x).toBe("bad ${EM} value");\n`,
    });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /em-dash/);
});

test('fails when en-dash appears in a describe label', () => {
    const result = run({
        'src/thing.test.ts': `describe("thing ${EN} label", () => {});\n`,
    });
    assert.equal(result.code, 1);
});

test('allows em-dash inside single-line comment', () => {
    const result = run({
        'src/example.test.ts': `// historical prose ${EM} allowed here\nit("ok", () => {});\n`,
    });
    assert.equal(result.code, 0, result.stderr);
});

test('allows em-dash inside block comment', () => {
    const result = run({
        'src/example.test.ts': `/* long note ${EM} spans\n * multiple ${EM} lines */\nit("ok", () => {});\n`,
    });
    assert.equal(result.code, 0, result.stderr);
});
