## Root cause (verified)

`version.json` says `5.12.0`. The pushed tag is `v5.12.1`. `release.yml` `setup` (lines 256-258) hard-fails on that mismatch, which skips every `build-*` and `release` job. Only the early `create-release-page` job runs, so v5.12.1's tag page exists with placeholder body and zero built assets. Also, `sync-repo-slug.mjs` was never actually wired into `release.yml` despite the v5.12.0 memory saying so.

## Fix

1. `version.json`: set `version` to `5.12.1`, `releaseDate`/`date` to today.
2. `.github/workflows/release.yml` `setup`:
   - Add `node scripts/sync-repo-slug.mjs` step right after "Checkout resolved ref".
   - Change the `PUBLISH_TAG != TARGET_TAG` fatal into self-heal: when they differ in CI, rewrite `version.json` in-workflow to match the tag and continue (strict mode gated behind an env var for local runs).
3. Re-trigger `release.yml` for `v5.12.1` via `workflow_dispatch` so assets upload to the existing tag page (no new tag).
4. `.lovable/memory/features/release-pipeline-repo-url-agnostic.md`: add "Known failure modes" section with the version/tag drift case; remove the false claim about sync-repo-slug wiring (now true after step 2).
5. `.lovable/cicd/issues/03-release-page-empty-v5-12-1-version-json-drift.md`: new RCA doc.
6. Root `readme.md`: one-line note in the existing "Repo rename & release pipeline" section pointing at the new self-heal.

## Verification

- Re-view `release.yml` diff.
- `node scripts/sync-repo-slug.mjs` -> exit 0.
- `node scripts/check-installer-contract.mjs` -> exit 0.

## Not doing

- No new tag, no v5.12.2 bump, no changelog rewrite, no new watcher/auditor workflow.
