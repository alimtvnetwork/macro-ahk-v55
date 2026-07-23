import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CHECKER = join(process.cwd(), "scripts/check-bare-throw.mjs");

function runChecker(root) {
  return spawnSync(process.execPath, [CHECKER, "--root", root], { encoding: "utf8" });
}

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), "bare-throw-"));
  mkdirSync(join(dir, "errors"), { recursive: true });
  mkdirSync(join(dir, "core"), { recursive: true });
  mkdirSync(join(dir, "core/__tests__"), { recursive: true });
  return dir;
}

test("passes when only compliant files exist", () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, "errors/registry.ts"), "throw new Error('registry ok');\n");
    writeFileSync(join(dir, "core/compliant.ts"), "throw new DiagnosticError('X');\n");
    writeFileSync(join(dir, "core/allow-marker.ts"), "throw new Error('boom'); // allow-bare-throw\n");
    writeFileSync(join(dir, "core/__tests__/x.test.ts"), "throw new Error('test fixture');\n");
    const res = runChecker(dir);
    assert.equal(res.status, 0, res.stderr || res.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails and reports file:line on a violation", () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, "core/bad.ts"), "// header\nthrow new Error('nope');\n");
    const res = runChecker(dir);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /core\/bad\.ts:2/);
    assert.match(res.stderr, /1 bare throw/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
