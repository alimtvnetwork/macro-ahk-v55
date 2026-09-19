# v5.25.0 git tag skipped

Previous version: 5.24.0
New version: 5.25.0

## Step that failed

Step 8, Tag and commit.

## Command run

`git tag v5.25.0` (not executed)

## Output

Git state is managed by the platform in this environment, so no commit or tag can be created from here.

## Files involved

- `version.json`
- `manifest.json`
- `readme.md`
- `changelog.md`

## Resolution

Workaround: publish through **Actions > Tag and Release** with version `5.25.0` once this commit lands on `main`. That workflow creates or safely reuses the immutable tag and calls `release.yml` via `workflow_call`, which now also verifies the published assets with `scripts/check-release-assets.mjs`.