import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CHECKER = join(process.cwd(), "scripts/check-vi-func.mjs");

function runChecker(root) {
  return spawnSync(process.execPath, [CHECKER, "--root", root], { encoding: "utf8" });
}

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), "check-vi-func-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  return dir;
}

test("passes when only vi.fn is used", () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, "src/a.test.ts"), "const spy = vi.fn();\n");
    writeFileSync(join(dir, "src/b.test.ts"), "vi.fn().mockReturnValue(1);\n");
    const res = runChecker(dir);
    assert.equal(res.status, 0, res.stderr || res.stdout);
    assert.match(res.stdout, /OK: no vi\.func/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails and reports file:line for vi.func usage", () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, "src/bad.test.ts"), "// header\nconst spy = vi.func();\n");
    const res = runChecker(dir);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /src\/bad\.test\.ts:2/);
    assert.match(res.stderr, /vi\.func/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports every occurrence across multiple files and lines", () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, "src/one.ts"), "vi.func();\nvi.func();\n");
    writeFileSync(join(dir, "src/two.ts"), "\n\nvi.func();\n");
    const res = runChecker(dir);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /src\/one\.ts:1/);
    assert.match(res.stderr, /src\/one\.ts:2/);
    assert.match(res.stderr, /src\/two\.ts:3/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("does not match unrelated identifiers containing 'func'", () => {
  const dir = makeFixture();
  try {
    writeFileSync(
      join(dir, "src/ok.ts"),
      "const func = () => 1;\nobj.function;\nsomething.funcs;\nxvi.func();\n",
    );
    const res = runChecker(dir);
    assert.equal(res.status, 0, res.stderr || res.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("word boundary: vifunc and vi_func are not flagged", () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, "src/x.ts"), "vifunc();\nvi_func();\n");
    const res = runChecker(dir);
    assert.equal(res.status, 0, res.stderr || res.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("skips node_modules and dist directories", () => {
  const dir = makeFixture();
  try {
    mkdirSync(join(dir, "node_modules/pkg"), { recursive: true });
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, "node_modules/pkg/index.js"), "vi.func();\n");
    writeFileSync(join(dir, "dist/bundle.js"), "vi.func();\n");
    const res = runChecker(dir);
    assert.equal(res.status, 0, res.stderr || res.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("skips .github/workflows and .gitmap prefixes", () => {
  const dir = makeFixture();
  try {
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    mkdirSync(join(dir, ".gitmap"), { recursive: true });
    writeFileSync(join(dir, ".github/workflows/ci.yml"), "note: vi.func is banned\n");
    writeFileSync(join(dir, ".gitmap/notes.md"), "vi.func banned\n");
    const res = runChecker(dir);
    assert.equal(res.status, 0, res.stderr || res.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("skips changelog.md basename", () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, "changelog.md"), "- banned vi.func regression\n");
    const res = runChecker(dir);
    assert.equal(res.status, 0, res.stderr || res.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ignores non-source extensions like .txt and .png", () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, "notes.txt"), "vi.func();\n");
    writeFileSync(join(dir, "image.png"), "vi.func();\n");
    const res = runChecker(dir);
    assert.equal(res.status, 0, res.stderr || res.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detects vi.func inside markdown and yaml source files", () => {
  const dir = makeFixture();
  try {
    writeFileSync(join(dir, "src/doc.md"), "example: `vi.func()` bad\n");
    const res = runChecker(dir);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /src\/doc\.md:1/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
