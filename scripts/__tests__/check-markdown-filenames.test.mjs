import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKER = resolve(
  fileURLToPath(new URL("../check-markdown-filenames.mjs", import.meta.url)),
);

function makeSandbox() {
  return mkdtempSync(join(tmpdir(), "markdown-filename-check-"));
}

function writeSandboxFile(root, relativePath) {
  const targetPath = join(root, relativePath);
  mkdirSync(join(targetPath, ".."), { recursive: true });
  writeFileSync(targetPath, "# test\n", "utf8");
}

function runChecker(root) {
  return spawnSync(process.execPath, [CHECKER, root], {
    encoding: "utf8",
  });
}

test("passes lowercase, ALL-CAPS, and sequence-first subtask filenames", () => {
  const root = makeSandbox();
  try {
    writeSandboxFile(root, "readme.md");
    writeSandboxFile(root, "RELEASE_NOTES.md");
    writeSandboxFile(root, ".lovable/plans/subtasks/24-eslint-cleanup/01-scope.md");
    writeSandboxFile(root, ".lovable/plans/subtasks/24-eslint-cleanup/04a-follow-up.md");

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Markdown filename policy OK/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails old ss-prefixed subtask filenames", () => {
  const root = makeSandbox();
  try {
    writeSandboxFile(root, ".lovable/plans/subtasks/24-eslint-cleanup/ss-01-scope.md");

    const result = runChecker(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /ss-01-scope\.md/);
    assert.match(result.stderr, /must start with the numeric sequence/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails mixed-case markdown filenames", () => {
  const root = makeSandbox();
  try {
    writeSandboxFile(root, "Mixed-Case.md");

    const result = runChecker(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Mixed-Case\.md/);
    assert.match(result.stderr, /lowercase hyphen-case/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails uppercase markdown extensions", () => {
  const root = makeSandbox();
  try {
    writeSandboxFile(root, "01-valid-name.MD");

    const result = runChecker(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /01-valid-name\.MD/);
    assert.match(result.stderr, /extension must be lowercase/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails stale ss-prefixed subtask path references in markdown", () => {
  const root = makeSandbox();
  try {
    const planPath = ".lovable/plans/pending/24-eslint-cleanup.md";
    const targetPath = join(root, planPath);
    mkdirSync(join(targetPath, ".."), { recursive: true });
    writeFileSync(
      targetPath,
      "See ./subtasks/24-eslint-cleanup/SS-01-scope.md\n",
      "utf8",
    );

    const result = runChecker(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /stale subtask path reference/);
    assert.match(result.stderr, /SS-/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});