# Issue 09: Version string duplicated across many files instead of read from version.json

Status: open
Created: 2026-07-20
Related command: ../../spec/commands/05-version-json-single-source-of-truth.md

## Symptom

Releasing requires hand-editing (or running a local script that edits) the
version pin in ~14 files: `manifest.json`, `src/shared/constants.ts`, root
`readme.md`, `standalone-scripts/**/readme.md`, install scripts, prompt bodies,
`.gitmap/release/*.json`, changelog headings, etc. Drift between these files
causes repeated CI failures (audit-releases, release-readiness, manifest diff,
latest.json mismatch) and user frustration.

## Expected

Editing `version.json` at the repo root is the ONLY step a human performs. All
downstream references either:
  a) read `version.json` at build/runtime, or
  b) are rewritten by a CI/CD workflow whose sole input is `version.json`.

## Actual

- `scripts/update-stale-version-refs.mjs` exists but is run locally by humans.
- Many files embed literal `4.301.0` strings.
- CI has repeatedly failed on drift between `version.json`, `latest.json`,
  and asset manifests.

## Repro

1. Bump `version.json` to a new MINOR.
2. Push without running the local propagator.
3. Observe multiple CI jobs fail with drift errors.

## Files likely involved

- `version.json`
- `scripts/update-stale-version-refs.mjs`
- `scripts/check-version-sync.mjs`
- `.github/workflows/release.yml`, `ci.yml`, `audit-releases.yml`
- `manifest.json`, `src/shared/constants.ts`, all `readme.md`
- `.gitmap/release/latest.json`

## Resolution

Tracked by plan `.lovable/plans/pending/29-version-json-single-source-of-truth.md`.
