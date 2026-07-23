#!/usr/bin/env node
/**
 * Plan 26 / Step 15: static gate for the diagnostic error-code registry.
 *
 * Verifies `standalone-scripts/macro-controller/src/errors/error-codes.ts`:
 *   1. Every entry key equals its `code` field.
 *   2. Codes are globally unique (case-sensitive).
 *   3. Code shape: <AREA>_<VERB(_VERB)*>_E<3+ digits>.
 *   4. `area` matches one of the ErrorArea union members.
 *   5. `severity` in {fatal, error, warn, info}.
 *   6. Every `{placeholder}` in `humanTemplate` (and `nextFixHint`) appears in `requiredContextKeys`.
 *   7. `humanTemplate` is non-empty and does NOT contain banned tokens (oops, wtf, "Failed." bare).
 *   8. `requiredContextKeys` has no duplicates.
 *
 * Also accepts an override path as argv[2] for the self-test.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REGISTRY = resolve(
  fileURLToPath(new URL("..", import.meta.url)),
  "standalone-scripts/macro-controller/src/errors/error-codes.ts",
);

const REGISTRY_PATH = resolve(process.cwd(), process.argv[2] ?? DEFAULT_REGISTRY);

const ALLOWED_AREAS = new Set([
  "PROMPT", "PROMPT_IO", "SEED", "HEALTH", "REPAIR", "HISTORY", "DB",
  "HTTP", "SDK", "WS_MEMBERS", "WS_MOVE", "WS_CONTEXT", "REMIX", "RENAME",
  "GITSYNC", "CREDIT", "PROZERO", "SETTINGS", "SPLITTER", "TELEMETRY", "UI",
  "ASYNC", "LOOP", "QUEUE", "TYPE",
]);
const ALLOWED_SEVERITIES = new Set(["fatal", "error", "warn", "info"]);
const CODE_SHAPE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_E\d{3,}$/u;
const BANNED_TOKEN = /\b(oops|wtf|dammit)\b/iu;
const PLACEHOLDER_RE = /(^|[^{])\{([a-zA-Z_][a-zA-Z0-9_]*)\}/gu;

/**
 * Extract each entry block from the registry source.
 * Returns [{ key, block, startLine }].
 */
function extractEntries(source) {
  const entries = [];
  const lines = source.split("\n");
  // Header shape: `  KEY: {` at start of line (2+ spaces of indent inside ERROR_CODES).
  const HEADER = /^ {2,}([A-Z][A-Z0-9_]*)\s*:\s*\{\s*$/u;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = HEADER.exec(line);
    if (!match) continue;
    // Walk until we find the matching closing brace at the same indent depth.
    const indent = line.match(/^( *)/u)[1].length;
    const closeRe = new RegExp(`^ {${indent}}\\},?\\s*$`, "u");
    let end = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (closeRe.test(lines[j])) { end = j; break; }
    }
    if (end === -1) continue;
    entries.push({
      key: match[1],
      block: lines.slice(i, end + 1).join("\n"),
      startLine: i + 1,
    });
    i = end;
  }
  return entries;
}

/**
 * Parse a single entry block into a shallow field map.
 * Handles single-line and multi-line string values wrapped in single quotes.
 */
function parseEntry(block) {
  const fields = {};
  // code / area / action / severity: 'value'
  for (const key of ["code", "area", "action", "severity"]) {
    const re = new RegExp(`^\\s*${key}:\\s*'([^']*)'\\s*,?`, "mu");
    const m = re.exec(block);
    if (m) fields[key] = m[1];
  }
  // humanTemplate (possibly multi-line quoted string on next line)
  const htRe = /humanTemplate:\s*([\s\S]*?),\s*\n\s*requiredContextKeys/u;
  const htMatch = htRe.exec(block);
  if (htMatch) {
    fields.humanTemplate = stripStringLiteral(htMatch[1]);
  }
  // requiredContextKeys: [ ... ]
  const rckRe = /requiredContextKeys:\s*\[([^\]]*)\]/u;
  const rckMatch = rckRe.exec(block);
  if (rckMatch) {
    fields.requiredContextKeys = [...rckMatch[1].matchAll(/'([^']+)'/gu)].map((m) => m[1]);
  }
  // nextFixHint (optional, single- or multi-line)
  const nfhRe = /nextFixHint:\s*([\s\S]*?),?\s*\n\s*(?:deprecated|replacedBy|\})/u;
  const nfhMatch = nfhRe.exec(block);
  if (nfhMatch) {
    const raw = stripStringLiteral(nfhMatch[1]);
    if (raw) fields.nextFixHint = raw;
  }
  // deprecated
  if (/deprecated:\s*true/u.test(block)) fields.deprecated = true;
  return fields;
}

function stripStringLiteral(raw) {
  // Concatenate 'part1' 'part2' fragments and remove wrapping quotes.
  const parts = [...raw.matchAll(/'([^']*)'/gu)].map((m) => m[1]);
  return parts.join("");
}

function collectPlaceholders(template) {
  const out = new Set();
  let m;
  while ((m = PLACEHOLDER_RE.exec(template)) !== null) out.add(m[2]);
  return [...out];
}

function main() {
  if (!existsSync(REGISTRY_PATH)) {
    process.stderr.write(`error-codes registry not found at ${REGISTRY_PATH}\n`);
    process.exit(2);
  }
  const source = readFileSync(REGISTRY_PATH, "utf8");
  const entries = extractEntries(source);
  const violations = [];
  const seenCodes = new Map();

  if (entries.length === 0) {
    violations.push({ code: "<none>", reason: "no entries found in registry — parser or file is broken" });
  }

  for (const entry of entries) {
    const { key, block, startLine } = entry;
    const parsed = parseEntry(block);
    const label = `${key} (line ${startLine})`;

    if (!parsed.code) {
      violations.push({ code: label, reason: "missing `code` field" });
    } else if (parsed.code !== key) {
      violations.push({ code: label, reason: `object key "${key}" does not match code "${parsed.code}"` });
    }
    if (parsed.code) {
      if (!CODE_SHAPE.test(parsed.code)) {
        violations.push({ code: label, reason: `code "${parsed.code}" violates shape <AREA>_<VERB>_E<NNN>` });
      }
      if (seenCodes.has(parsed.code)) {
        violations.push({ code: label, reason: `duplicate code (also at ${seenCodes.get(parsed.code)})` });
      } else {
        seenCodes.set(parsed.code, `line ${startLine}`);
      }
    }
    if (!parsed.area || !ALLOWED_AREAS.has(parsed.area)) {
      violations.push({ code: label, reason: `area "${parsed.area}" not in allowed union` });
    }
    if (!parsed.severity || !ALLOWED_SEVERITIES.has(parsed.severity)) {
      violations.push({ code: label, reason: `severity "${parsed.severity}" not in {fatal,error,warn,info}` });
    }
    if (!parsed.humanTemplate) {
      violations.push({ code: label, reason: "missing/empty humanTemplate" });
    } else {
      if (BANNED_TOKEN.test(parsed.humanTemplate)) {
        violations.push({ code: label, reason: `humanTemplate contains banned token (oops/wtf/dammit)` });
      }
      if (/^\s*Failed\.?\s*$/u.test(parsed.humanTemplate)) {
        violations.push({ code: label, reason: `humanTemplate is bare "Failed" — describe attempt + cause + fix` });
      }
    }
    const rck = parsed.requiredContextKeys ?? [];
    const dupes = rck.filter((v, i, arr) => arr.indexOf(v) !== i);
    if (dupes.length > 0) {
      violations.push({ code: label, reason: `duplicate requiredContextKeys: ${[...new Set(dupes)].join(",")}` });
    }
    if (parsed.humanTemplate) {
      const templatePlaceholders = collectPlaceholders(parsed.humanTemplate);
      const hintPlaceholders = parsed.nextFixHint ? collectPlaceholders(parsed.nextFixHint) : [];
      const allPlaceholders = new Set([...templatePlaceholders, ...hintPlaceholders]);
      const rckSet = new Set(rck);
      for (const ph of allPlaceholders) {
        if (!rckSet.has(ph)) {
          violations.push({
            code: label,
            reason: `placeholder "{${ph}}" not listed in requiredContextKeys`,
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    process.stderr.write(`\nError-code registry violations (${violations.length}):\n`);
    for (const v of violations) {
      process.stderr.write(`  - ${v.code}: ${v.reason}\n`);
    }
    process.stderr.write(`\nRegistry: ${REGISTRY_PATH}\n`);
    process.exit(1);
  }

  process.stdout.write(`OK: ${entries.length} error codes validated (${seenCodes.size} unique).\n`);
}

main();
