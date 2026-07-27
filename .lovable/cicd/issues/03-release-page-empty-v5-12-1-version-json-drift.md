# CI/CD Issue 03 - Release page empty on v5.12.1 (version.json vs tag drift)

## Pipeline / Workflow

`.github/workflows/release.yml` (`setup` job -> "Read version from version.json")

## Description

The `v5.12.1` tag existed on GitHub, but the corresponding Release page had
only the auto-generated source archives (no `marco-extension-*.zip`, no
installer scripts, no checksums) and the body was the early-job placeholder.
Identical symptom to Issue 02, different root cause.

## First seen

- Reported: 2026-07-27, tag `v5.12.1`
- Screenshot in chat: only `zip` / `tar.gz` on the tag page, body missing.

## Root cause

`.gitmap` published `v5.12.1` (see `.gitmap/release/latest.json`) but the
release ceremony left root `version.json` at `5.12.0`. In `release.yml` the
`setup` job read `version.json` -> `PUBLISH_TAG=v5.12.0`, compared it to
`TARGET_TAG=v5.12.1`, and hard-exited (`exit 1`). That failed `setup`,
which was `needs:` for every `build-*` job and for the terminal `release`
job. Only `create-release-page` (no `needs:`) ran, which is why the tag
page existed with a placeholder body and zero built assets.

Secondary cause: the v5.12.0 fix documented that `sync-repo-slug.mjs` runs
first in `release.yml -> setup`, but it wasn't actually wired there - only
in `installer-tests.yml`. A repo rename would have re-triggered the v5.11.0
failure class even after the v5.12.0 changes.

## Status

Resolved - 2026-07-27

## Fix

- **New rule (non-negotiable):** the GIT TAG is the single source of truth
  for the release version. `version.json` is a build-time artifact, no
  longer a hand-edited pin. Spec:
  `.lovable/spec/commands/05-tag-is-single-source-of-truth-for-version.md`.
- Added `scripts/write-version-from-tag.mjs` which resolves the version
  from `$VERSION`, then `GITHUB_REF_NAME`, then `git describe`, then
  falls back to `0.0.0-dev`, and rewrites root `version.json` so every
  existing reader sees the same value with no code changes.
- `release.yml → setup` now derives `VERSION` from the resolved tag, deletes
  the `version.json` vs tag comparison entirely, and runs
  `write-version-from-tag.mjs`. `sync-repo-slug.mjs` also runs first
  (delivering on the v5.12.0 memory promise).
- Every build job regenerates `version.json` from
  `needs.setup.outputs.publish_tag` right after checkout.
- Root `version.json` reset to the placeholder `0.0.0-dev` — future
  releases never require a version.json edit.

## Recovery for v5.12.1

Re-run `release.yml` via `workflow_dispatch` with input `version=v5.12.1`.
`setup` derives the version from that tag, regenerates `version.json`,
`build-*` and `release` run, and `softprops/action-gh-release` overwrites
the placeholder body with real notes and uploads the ZIPs, installers,
checksums, and notes to the existing tag page. No `version.json` edit
needed, ever again.

## Prevention

- The class of failure ("version.json out of sync with tag") is deleted:
  there is no version.json to be out of sync any more; the tag IS the
  version.
- `sync-repo-slug.mjs` is now truly wired into `release.yml`, matching the
  memory contract.
- No new watcher / auditor workflow added (blocked by
  `mem://constraints/release-assets-publish-contract`).

## References

- `.lovable/cicd/issues/02-release-page-missing-built-assets.md`
- `.lovable/memory/features/release-pipeline-repo-url-agnostic.md`
- `.lovable/memory/constraints/release-assets-publish-contract.md`
- `.github/workflows/release.yml`