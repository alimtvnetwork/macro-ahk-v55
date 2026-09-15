---
name: release-management
description: Execute full release ceremony, SemVer version bumps, package synchronization, and changelog updates.
---

# Release Management

Conducts the standardized release ceremony for coding-guidelines-v24.

## Steps

1. Determine bump tier (MINOR default, reset PATCH to 0).
2. **Mandatory Pre-Release Unit Tests & CI/CD Verification:** Execute `python 03-ai-scripts/06-cicd-local-runner.py --run-tests` and verify all unit test suites, AST checks, and quality gates pass 100% green (`exit 0`).
3. **Test Inventory Validation:** Cross-reference `.lovable/temp/recent-file-changes.json` with `.lovable/test-inventory.json` to verify that all test suites covering recently modified files pass completely.
4. Update version in `package.json` and run `npm run sync`.
5. Prepend entry to `changelog.md` with verified, concrete changes.
6. Commit: `chore(release): bump version to X.Y.0`.
7. DO NOT create manual git tag if managed externally.
8. Push to remote.
