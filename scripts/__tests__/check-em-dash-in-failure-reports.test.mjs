import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const SCRIPT = resolve(ROOT, "scripts/check-em-dash-in-failure-reports.mjs");

function runIn(cwd) {
    const copied = join(cwd, "scripts/check-em-dash-in-failure-reports.mjs");
    return spawnSync(process.execPath, [copied], { cwd, encoding: "utf8" });
}

function scaffold() {
    const dir = mkdtempSync(join(tmpdir(), "em-dash-fr-"));
    mkdirSync(join(dir, "scripts"));
    mkdirSync(join(dir, "src/background/recorder"), { recursive: true });
    mkdirSync(join(dir, "src/components/recorder"), { recursive: true });
    cpSync(SCRIPT, join(dir, "scripts/check-em-dash-in-failure-reports.mjs"));
    return dir;
}

test("pass: emitter files with only ASCII code content", () => {
    const dir = scaffold();
    writeFileSync(
        join(dir, "src/background/recorder/failure-logger.ts"),
        `/* Marco \u2014 Recorder Failure Logger, comment em-dash allowed */\nexport const REASON = "ZeroMatches";\n`,
    );
    const result = runIn(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /0 offenders/);
    rmSync(dir, { recursive: true, force: true });
});

test("fail: em-dash inside string literal", () => {
    const dir = scaffold();
    writeFileSync(
        join(dir, "src/components/recorder/failure-toast.ts"),
        `export const M = "Clipboard unavailable \u2014 see console";\n`,
    );
    const result = runIn(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failure-toast\.ts:1/);
});

test("fail: en-dash inside template literal", () => {
    const dir = scaffold();
    writeFileSync(
        join(dir, "src/background/recorder/failure-logger.ts"),
        "export const M = `Reason\u2013Detail`;\n",
    );
    const result = runIn(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failure-logger\.ts:1/);
});

test("exempt: single-line // comment", () => {
    const dir = scaffold();
    writeFileSync(
        join(dir, "src/background/recorder/failure-logger.ts"),
        `// note \u2014 historical prose\nexport const R = "ok";\n`,
    );
    const result = runIn(dir);
    assert.equal(result.status, 0, result.stderr);
    rmSync(dir, { recursive: true, force: true });
});

test("exempt: JSDoc block comment", () => {
    const dir = scaffold();
    writeFileSync(
        join(dir, "src/background/recorder/failure-logger.ts"),
        `/**\n * Marco \u2014 Recorder Failure Logger\n */\nexport const R = "ok";\n`,
    );
    const result = runIn(dir);
    assert.equal(result.status, 0, result.stderr);
    rmSync(dir, { recursive: true, force: true });
});
