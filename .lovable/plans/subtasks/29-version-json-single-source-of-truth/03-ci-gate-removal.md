# SS-03: Remove version-drift CI gates

Parent: 29-version-json-single-source-of-truth
Slug: ci-gate-removal
Status: pending
Created: 2026-07-20

## Goal

Eliminate every CI check that fails on version drift, missing release-asset
manifests, or `latest.json` vs `version.json` mismatch. These have caused
repeated release-blocking failures the user has explicitly banned.

## Checks to remove or downgrade to warnings

- `scripts/check-release-readiness.mjs` invocations in any workflow (already
  removed; verify none reappear).
- `.github/workflows/release.yml` "Preflight release readiness" step
  (already removed; verify).
- `.github/workflows/release-watcher.yml` required-assets loop
  (already removed; verify).
- `.github/workflows/audit-releases.yml` required-assets FAIL counter
  (already removed; verify no `exit 1` on missing assets).
- `.github/workflows/demote-incomplete-releases.yml` — evaluate whether to
  keep as advisory only (never fail) or delete entirely.
- Any `check-version-sync.mjs` invocation in CI: downgrade to a warning-only
  step, or move behind the propagator so it can never fail (propagator
  rewrites, then sync is by construction).

## Acceptance

- `rg -n 'check-release-readiness' .github/ scripts/` returns only the shim.
- `rg -n 'exit 1' .github/workflows/` shows no version/asset-drift exit.
- A bump of `version.json` with no other edits produces a green CI run.
