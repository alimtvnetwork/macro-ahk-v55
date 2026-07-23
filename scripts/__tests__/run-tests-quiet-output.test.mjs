import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  extractWarningLines,
  findLastActiveTest,
  formatFailureReport,
  formatSuccessReport,
  stripAnsi,
} from "../lib/quiet-test-output.mjs";

test("success report suppresses passing dot output and keeps summary", () => {
  const report = formatSuccessReport("RUN\n...\n Test Files  2 passed (2)\n      Tests  4 passed (4)\n   Duration  1.2s", "");

  assert.match(stripAnsi(report), /Test Files  2 passed/);
  assert.match(stripAnsi(report), /All tests passed/);
  assert.doesNotMatch(stripAnsi(report), /RUN\n\.\.\./);
});

test("warning extraction ignores skipped counters from successful batch logs", () => {
  const lines = extractWarningLines(
    "[MacroLoop] done (attempted=1, fetched=1, skipped=0)",
    "[tool] Warning: deprecated option",
  );

  assert.deepEqual(lines, ["[tool] Warning: deprecated option"]);
});

test("failure report uses red ANSI coloring and failure symbol", () => {
  const report = formatFailureReport(1, " FAIL  src/example.test.ts\nAssertionError: expected 1", "");

  assert.match(report, /\x1b\[31m/);
  assert.match(report, /✖ \[FAIL\]/);
  assert.match(stripAnsi(report), /AssertionError/);
});

test("abrupt failure report names last active test when Vitest emits no failure block", () => {
  const stdout = "stdout | suite.test.ts > suite > current case\npartial log";
  const report = stripAnsi(formatFailureReport(1, stdout, ""));

  assert.match(report, /No Vitest failure block was emitted/);
  assert.match(report, /Last active test: stdout \| suite.test.ts > suite > current case/);
});

test("last active test parser strips color codes", () => {
  const active = findLastActiveTest("\x1b[90mstdout\x1b[0m | a.test.ts > a > b", "");

  assert.equal(active, "stdout | a.test.ts > a > b");
});