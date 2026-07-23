/**
 * Tests for scripts/check-readme-txt.mjs
 *
 * Generates synthetic readme.txt contents in a temp directory and runs the
 * checker against each one, asserting the exit code + diagnostic reason.
 *
 * Policy: tests NEVER touch the real repo `readme.txt` (SP-1).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKER = resolve(
  fileURLToPath(new URL("../check-readme-txt.mjs", import.meta.url)),
);

function runCheckerWith(content, { omitFile = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "readme-txt-check-"));
  try {
    if (!omitFile) {
      writeFileSync(join(dir, "readme.txt"), content, "utf8");
    }
    const result = spawnSync(process.execPath, [CHECKER], {
      cwd: dir,
      encoding: "utf8",
    });
    return {
      code: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("PASS: exactly three plain words, no trailing newline", () => {
  const r = runCheckerWith("let us start");
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /readme\.txt OK/);
  assert.match(r.stdout, /\["let","us","start"\]/);
});

test("PASS: exactly three plain words with a single trailing newline", () => {
  const r = runCheckerWith("let us start\n");
  assert.equal(r.code, 0, r.stderr);
});

test("PASS: apostrophes inside a word are allowed", () => {
  const r = runCheckerWith("let's start now\n");
  assert.equal(r.code, 0, r.stderr);
});

test("FAIL: file missing entirely", () => {
  const r = runCheckerWith("", { omitFile: true });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /FileMissing/);
});

test("FAIL: empty file", () => {
  const r = runCheckerWith("");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /EmptyFile/);
});

test("FAIL: only two words", () => {
  const r = runCheckerWith("let us\n");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /WrongWordCount/);
  assert.match(r.stderr, /found 2/);
});

test("FAIL: four words", () => {
  const r = runCheckerWith("let us start now\n");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /WrongWordCount/);
  assert.match(r.stderr, /found 4/);
});

test("FAIL: contains a date token (SP-2/SP-8)", () => {
  const r = runCheckerWith("let us 27-Apr-2026\n");
  assert.equal(r.code, 1);
  // Either WrongWordCount-style or NonWordToken — both are acceptable failures.
  assert.match(r.stderr, /NonWordToken|WrongWordCount/);
});

test("FAIL: contains a 12-hour time token (SP-2)", () => {
  const r = runCheckerWith("let's start now 27-Apr-2026 03:55:22 PM\n");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /WrongWordCount|NonWordToken/);
  assert.match(r.stderr, /forbidden/i);
});

test("FAIL: multi-line content rejected", () => {
  const r = runCheckerWith("let us start\nextra line\n");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /MultipleLines|WrongWordCount/);
});

test("FAIL: digit-bearing token rejected (NonWordToken)", () => {
  const r = runCheckerWith("let us 123\n");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /NonWordToken/);
});

test("FAIL: punctuation-only token rejected", () => {
  const r = runCheckerWith("let us !!!\n");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /NonWordToken/);
});

test("FAIL: leading/trailing extra whitespace producing wrong count", () => {
  const r = runCheckerWith("  let us start now  \n");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /WrongWordCount/);
});

test("FAIL: two trailing newlines (extra blank line)", () => {
  const r = runCheckerWith("let us start\n\n");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /MultipleLines|WrongWordCount/);
});
