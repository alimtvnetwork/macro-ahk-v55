import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKER = resolve(
  fileURLToPath(new URL("../check-error-codes-unique.mjs", import.meta.url)),
);

const HEADER = `export const ERROR_CODES = Object.freeze({\n`;
const FOOTER = `});\n`;

function makeRegistry(body) {
  const dir = mkdtempSync(join(tmpdir(), "err-codes-check-"));
  const file = join(dir, "error-codes.ts");
  writeFileSync(file, HEADER + body + FOOTER, "utf8");
  return file;
}

function run(file) {
  return spawnSync(process.execPath, [CHECKER, file], { encoding: "utf8" });
}

const VALID = `  PROMPT_VALIDATE_E001: {
    code: 'PROMPT_VALIDATE_E001',
    area: 'PROMPT',
    action: 'VALIDATE',
    severity: 'error',
    humanTemplate:
      'Cannot save {role} prompt "{slug}": found {actual}.',
    requiredContextKeys: ['role', 'slug', 'actual'],
    nextFixHint: 'Retry the save.',
  },
`;

test("accepts a well-formed entry", () => {
  const result = run(makeRegistry(VALID));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 error codes validated/u);
});

test("rejects duplicate codes", () => {
  const dup = VALID + VALID.replace(/PROMPT_VALIDATE_E001/gu, "PROMPT_VALIDATE_E001");
  // Ensure the object key is unique (parser skips true dup keys); rename key only.
  const body = VALID + `  PROMPT_VALIDATE_E001_DUP: {
    code: 'PROMPT_VALIDATE_E001',
    area: 'PROMPT',
    action: 'VALIDATE',
    severity: 'error',
    humanTemplate:
      'x {a}.',
    requiredContextKeys: ['a'],
  },
`;
  const result = run(makeRegistry(body));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate code/u);
});

test("rejects mismatched key vs code field", () => {
  const body = `  PROMPT_VALIDATE_E001: {
    code: 'PROMPT_VALIDATE_E999',
    area: 'PROMPT',
    action: 'VALIDATE',
    severity: 'error',
    humanTemplate: 'x.',
    requiredContextKeys: [],
  },
`;
  const result = run(makeRegistry(body));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not match code/u);
});

test("rejects placeholder missing from requiredContextKeys", () => {
  const body = `  PROMPT_VALIDATE_E001: {
    code: 'PROMPT_VALIDATE_E001',
    area: 'PROMPT',
    action: 'VALIDATE',
    severity: 'error',
    humanTemplate:
      'Missing {ghost} token.',
    requiredContextKeys: ['role'],
  },
`;
  const result = run(makeRegistry(body));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /placeholder "\{ghost\}"/u);
});

test("rejects bad code shape", () => {
  const body = `  BAD_CODE: {
    code: 'BAD_CODE',
    area: 'PROMPT',
    action: 'VALIDATE',
    severity: 'error',
    humanTemplate: 'x.',
    requiredContextKeys: [],
  },
`;
  const result = run(makeRegistry(body));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /violates shape/u);
});

test("rejects unknown area and severity", () => {
  const body = `  PROMPT_VALIDATE_E001: {
    code: 'PROMPT_VALIDATE_E001',
    area: 'NOPE',
    action: 'VALIDATE',
    severity: 'panic',
    humanTemplate: 'x.',
    requiredContextKeys: [],
  },
`;
  const result = run(makeRegistry(body));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /area "NOPE"/u);
  assert.match(result.stderr, /severity "panic"/u);
});

test("rejects banned template tokens", () => {
  const body = `  PROMPT_VALIDATE_E001: {
    code: 'PROMPT_VALIDATE_E001',
    area: 'PROMPT',
    action: 'VALIDATE',
    severity: 'error',
    humanTemplate: 'Oops something bad.',
    requiredContextKeys: [],
  },
`;
  const result = run(makeRegistry(body));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /banned token/u);
});

test("passes the real macro-controller registry", () => {
  const result = spawnSync(process.execPath, [CHECKER], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /error codes validated/u);
});
