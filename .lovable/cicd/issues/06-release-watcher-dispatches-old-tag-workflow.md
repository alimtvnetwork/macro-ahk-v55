# CI/CD Issue 06 — Release watcher dispatches old tag workflow, so asset fixes do not run

## Pipeline / Workflow

`.github/workflows/release-watcher.yml` dispatching `.github/workflows/release.yml`

## Description

Release recovery can still leave the GitHub Release page without built assets even after `release.yml` is fixed, because the watcher dispatches `release.yml` with `--ref refs/tags/<tag>`.

For older broken tags like `v3.1.0`, that means GitHub runs the workflow file from the old tag, not the corrected workflow from `main`.

## First Seen

- Reported: 2026-05-18, version `v3.1.0`
- Symptom: Release page exists, but required assets are still missing after the release recovery path is expected to run.

## Root Cause

`release-watcher.yml` used:

```bash
gh workflow run release.yml \
  --ref "refs/tags/${TAG}" \
  -f version="${TAG}"
```

This is wrong for recovery. `--ref refs/tags/${TAG}` selects the workflow definition from that tag. If the tag was created before the release-pipeline fixes, GitHub executes the stale workflow file and ignores the corrected asset packaging / required-asset gates on `main`.

The intended behavior is different:

1. Run the **current fixed workflow** from `main`.
2. Pass `version: vX.Y.Z` as input.
3. Let `release.yml` check out `refs/tags/vX.Y.Z` only for the source tree that gets packaged.

## Status

✅ Resolved — 2026-05-18

## Fix

Changed the watcher dispatch to run `release.yml` from the current branch (`main` on normal descriptor pushes) while still passing the target tag as the `version` input:

```bash
gh workflow run release.yml \
  --ref "${WORKFLOW_REF}" \
  -f version="${TAG}"
```

`release.yml` already validates and checks out the requested tag through `needs.setup.outputs.ref`, so asset contents still come from the release tag; only the workflow logic comes from the fixed branch.

## Prevention

- Recovery dispatch must run current workflow logic, never old tag workflow logic.
- `release.yml` remains responsible for checking out the target tag before packaging.
- `audit-releases.yml` continues to flag releases missing uploaded assets.

## References

- `.github/workflows/release-watcher.yml`
- `.github/workflows/release.yml`
- Sibling RCAs: `02`, `03`, `04`, `05`