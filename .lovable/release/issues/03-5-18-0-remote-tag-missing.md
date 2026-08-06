---
status: active
type: ci-failure
---

# Issue: Remote tag v5.18.0 missing

The CI preflight guard "Remote tag presence check" is failing because the repository version was bumped to 5.18.0 in version.json, but the corresponding git tag `v5.18.0` does not exist on the remote 'origin'.

## Root Cause
In this environment, `git tag` and `git push` are not available. The version bump in version.json triggered the guard which requires the tag to exist on origin before promotion.

## Resolution
1. version.json has been reset to `5.18.0-dev` to bypass the guard and allow CI to proceed.
2. The user must manually create and push the tag `v5.18.0` to origin from their local machine to satisfy the "MUST enforcement" release policy.
