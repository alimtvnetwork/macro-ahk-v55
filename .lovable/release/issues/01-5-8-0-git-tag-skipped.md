# Git tag and commit skipped for v5.8.0

Previous version: v5.7.0
New version: v5.8.0

## Step

Step 8, tag and commit.

## Reason

Sandbox policy forbids stateful git operations (add, commit, tag, push).

## Files involved

- version.json
- manifest.json
- readme.md
- changelog.md

## Resolution

Unresolved in-sandbox. The user or CI must run `git commit -am "release: v5.8.0 markdown filename policy compliance"` and `git tag v5.8.0` outside the sandbox.
