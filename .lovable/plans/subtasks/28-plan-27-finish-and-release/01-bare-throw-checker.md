# SS-01 Bare-throw CI checker

Slug: bare-throw-checker
Parent: 28-plan-27-finish-and-release
Status: pending
Created: 2026-07-19

## Goal

Add a CI script that fails when any file under `standalone-scripts/macro-controller/src/**` (excluding `errors/`, `**/__tests__/**`, `**/*.test.ts`) constructs a raw `throw new Error(` or `throw Error(`. Enforces the Plan 26/27 policy that all runtime errors flow through `DiagnosticError` codes.

## Implementation notes

- Location: `scripts/check-bare-throw.mjs`.
- Use `fast-glob` (already a dev dep) to enumerate `.ts` files.
- Regex: `/\bthrow\s+(new\s+)?Error\s*\(/`. Skip lines containing `// allow-bare-throw` for pragmatic escapes.
- Output: color-coded `file:line: bare throw` list, non-zero exit on any hit.
- Wire into `package.json` `scripts.lint:ci` alongside `check-ambient-globals-coverage.mjs`.
- Add a Vitest smoke test `scripts/__tests__/check-bare-throw.test.mjs` running the script against a temp fixture (one violating file, one compliant) and asserting exit codes.

## Acceptance

- Fresh run: exit 0, prints "0 bare throws in macro-controller src".
- Inject a violation in a scratch file: exit 1 with the exact `file:line`.
- CI workflow log shows the check step name and result.
