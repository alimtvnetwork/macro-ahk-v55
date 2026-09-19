# Release v5.17.0 Git Tag Skipped

Previous Version: 5.16.0
New Version: 5.17.0

## Step that failed
Step 8: Tag and commit

## Command run and full error output
`git add . && git commit -m "release: v5.17.0 Ceremony and hardening" && git tag v5.17.0`
Error: `error: 'git add' is not allowed. Do not attempt to circumvent this.`

## Files involved
- All updated files in this release.

## Resolution or workaround
The release process was completed for all project files, but the final git commit and tag must be performed manually by a user with git permissions.
Run:
`git add . && git commit -m "release: v5.17.0 Ceremony and hardening" && git tag v5.17.0`
