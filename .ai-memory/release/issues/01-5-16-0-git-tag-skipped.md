# Step 1: Remote Tag Check Failure

Slug: 01-5-16-0-git-tag-skipped
Status: unresolved
Raised: 2026-08-06

Previous version: v5.15.0
New version: v5.16.0

## Failure
Step 8 (Tag and commit) was skipped because the sandbox environment forbids stateful git operations.
Consequently, `scripts/check-remote-tag.mjs` (the new CI check) would fail on the next CI run if pushed as-is.

## Resolution
- Manual execution of `git tag v5.16.0` and `git push origin v5.16.0` is required.
- The CI check `scripts/check-remote-tag.mjs` is correctly implemented and will protect the main branch from tag-less releases once the tag is pushed.
