## Fix cicd index sync failure

Add the missing entry for `cicd/issues/03-release-page-empty-v5-12-1-version-json-drift.md` to `.lovable/cicd/README.md` under `## Resolved` (release page issue was resolved by the tag-as-source-of-truth work in v5.12.1+).

### Steps
1. Read `.lovable/cicd/README.md` to find the exact `## Resolved` section format and matching sibling entry style.
2. Read `.lovable/cicd/issues/03-release-page-empty-v5-12-1-version-json-drift.md` for its title/summary line.
3. Append a bullet under `## Resolved` linking to `cicd/issues/03-release-page-empty-v5-12-1-version-json-drift.md` using the same format as neighboring entries.
4. Re-run `node scripts/check-cicd-index-sync.mjs` and confirm exit code 0.

No version bump, no release, no other files touched: this is a pure index-sync repair.
