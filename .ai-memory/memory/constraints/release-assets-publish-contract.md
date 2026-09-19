---
name: release publish contract
description: Publishing is version.json plus a matching v* tag. release.yml is the only publisher. No watcher, recovery, readiness, stale-ref, or asset-manifest gates.
type: constraint
---
## Rule

Publishing is intentionally minimal:

1. Edit root `version.json`.
2. Create the matching `v*` tag when publishing is needed.
3. Let `.github/workflows/release.yml` build and upload assets.

Do not add secondary release checkers or recovery loops.

## Forbidden

Never restore:

- release watcher workflows
- release demotion workflows
- latest-release recovery workflows
- readiness scripts
- stale-version propagation scripts
- asset-manifest generation or verification scripts
- historical version regex gates
- disabled-auditor placeholders

## Operator rule

If a release fails, fix `release.yml` or the build itself. Do not add another release workflow or checker around it.