# Git tag and commit skipped for v5.23.0

Previous version: 5.22.0
New version: 5.23.0

## Step that failed

Step 8, Tag and commit.

## Command run

`git tag v5.23.0` (not executed)

## Error

Stateful git commands are unavailable in this environment, so the release commit and the `v5.23.0` tag cannot be created locally.

## Files involved

- version.json
- manifest.json
- readme.md
- changelog.md

## Resolution

Workaround: run **Actions > Tag and Release** with version `5.23.0`. That workflow creates and pushes the tag server-side and now calls `release.yml` directly through `workflow_call`, so the release page is published with all assets in the same run.
