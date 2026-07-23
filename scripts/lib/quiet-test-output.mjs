const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
const ANSI_PATTERN = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const FAILURE_MARKERS = [
  /^\s*FAIL\s/,
  /Failed Suites/,
  /Failed Tests/,
  /AssertionError/,
  /Unhandled Errors/,
];

export const stripAnsi = (text) => text.replace(ANSI_PATTERN, "");

export const paintRed = (text) => RED + text + RESET;

export const paintGreen = (text) => GREEN + text + RESET;

const splitLines = (text) => text.split("\n").filter((line) => line.length > 0);

const joinedOutput = (stdout, stderr) => [stdout, stderr].filter(Boolean).join("\n");

const hasFailureMarker = (line) => FAILURE_MARKERS.some((pattern) => pattern.test(stripAnsi(line)));

const isWarningLine = (line) => /\b(warn|warning|deprecat)\b/i.test(stripAnsi(line));

const extractFromMarker = (line) => {
  const clean = stripAnsi(line);
  const markers = ["Test Files", "Tests", "Start at", "Duration"];
  const positions = markers.map((marker) => clean.indexOf(marker)).filter((position) => position >= 0);
  const first = Math.min(...positions);

  return first === Infinity ? clean : clean.slice(first).trim();
};

export const extractWarningLines = (stdout, stderr) => {
  return splitLines(joinedOutput(stdout, stderr)).filter(isWarningLine);
};

export const extractSummary = (stdout) => {
  const lines = splitLines(stdout);
  const summaryLines = lines.filter((line) => /\b(Test Files|Tests|Start at|Duration)\b/.test(stripAnsi(line)));

  return summaryLines.slice(-4).map(extractFromMarker).join("\n");
};

export const extractFailureBlock = (stdout, stderr) => {
  const lines = splitLines(joinedOutput(stdout, stderr));
  const start = lines.findIndex(hasFailureMarker);

  return start === -1 ? "" : lines.slice(start).join("\n");
};

export const tailLines = (text, count) => {
  const lines = splitLines(text);

  return lines.slice(Math.max(0, lines.length - count)).join("\n");
};

export const findLastActiveTest = (stdout, stderr) => {
  const lines = splitLines(joinedOutput(stdout, stderr));
  const activeLines = lines.filter((line) => /^(stdout|stderr) \| .+ > /.test(stripAnsi(line)));

  return stripAnsi(activeLines.at(-1) ?? "not detected");
};

export const formatSuccessReport = (stdout, stderr) => {
  const warnings = extractWarningLines(stdout, stderr);
  const summary = extractSummary(stdout);
  const blocks = [];

  if (warnings.length > 0) blocks.push("[run-tests-quiet] Warnings detected:\n" + warnings.join("\n"));
  if (summary.length > 0) blocks.push(summary);
  blocks.push(paintGreen("[run-tests-quiet] All tests passed."));

  return blocks.join("\n");
};

export const formatFailureReport = (code, stdout, stderr) => {
  const block = extractFailureBlock(stdout, stderr);
  const fallback = tailLines(joinedOutput(stdout, stderr), 160);
  const body = block.length > 0 ? block : buildAbruptFailureBody(stdout, stderr, fallback);

  return paintRed(`✖ [FAIL] Vitest failed with exit code ${code}.`) + "\n" + paintRed(body);
};

const buildAbruptFailureBody = (stdout, stderr, fallback) => {
  return [
    "No Vitest failure block was emitted.",
    "The worker process likely aborted before reporting the assertion.",
    "Last active test: " + findLastActiveTest(stdout, stderr),
    "Last captured output:",
    fallback,
  ].join("\n");
};