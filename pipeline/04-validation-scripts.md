# 04 — Validation Scripts

All validation scripts live in `scripts/` and are Node.js ESM (`.mjs`).
They exit with code 1 on failure, halting the build.

## Version Source

`version.json` is the single source of truth. Validation scripts must not require downstream version pins, generated manifests, release manifests, stale-reference rewrites, or changelog/readme propagation.

## Axios Version Check

**Script**: `scripts/check-axios-version.mjs`
**When**: Before every build (SDK, XPath, Controller, Extension)

Validates that the installed axios version is on the approved safe list.
Prevents accidentally shipping a version with known vulnerabilities.

## Standalone Dist Freshness

**Script**: `scripts/check-standalone-dist.mjs`
**When**: Before extension build

Verifies that each standalone script's `dist/` folder exists and contains
expected artifacts (the compiled JS bundle and instruction.json).

## Const Reassignment Lint

**Script**: `scripts/lint-const-reassign.mjs`
**When**: Before extension build

Scans for accidental `const` reassignment patterns that TypeScript
might miss in certain dynamic codepaths.

## Adding a New Validation

1. Create `scripts/check-{name}.mjs`
2. Use `process.exit(1)` on failure
3. Add it to the relevant `build:*` script chain in `package.json`
4. Log clear error messages (file path, what's wrong, expected value)
