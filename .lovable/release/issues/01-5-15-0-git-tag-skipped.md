# Issue: Git tag and commit skipped during sandbox release

Slug: 5-15-0-git-tag-skipped
Status: unresolved
Raised: 2026-08-06
Blocking: release v5.15.0

## Question
The automated release ceremony for v5.15.0 was unable to create a git tag or commit.

## Resolution
Sandbox policy prevents stateful git operations. The developer must manually tag the release on the remote repository.

Command to run:
```bash
git tag v5.15.0
git push origin v5.15.0
```
