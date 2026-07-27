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

- `release.yml -> setup` now runs `node scripts/sync-repo-slug.mjs` right
  after checkout of the resolved ref, before any script that reads the
  installer contract.
- "Read version from version.json" self-heals a `PUBLISH_TAG != TARGET_TAG`
  mismatch by default: it rewrites `version.json` in-workflow to match the
  pushed tag, emits a `::warning::`, and continues. Strict fatal is behind
  `vars.STRICT_VERSION_MATCH=1`.
- Root `version.json` bumped to `5.12.1` to match the pushed tag on main.
- Memory `.lovable/memory/features/release-pipeline-repo-url-agnostic.md`
  updated with a "Known failure modes" section for this drift.

## Recovery for v5.12.1

Re-run `release.yml` via `workflow_dispatch` with input `version=v5.12.1`.
With `version.json` now aligned (and the self-heal path in place regardless),
`setup` passes, `build-*` and `release` run, and `softprops/action-gh-release`
overwrites the placeholder body with real notes and uploads the ZIPs,
installers, checksums, and notes to the existing tag page.

## Prevention

- Self-heal removes the class of failure where a forgotten version bump
  bricks the pipeline.
- `sync-repo-slug.mjs` is now truly wired into `release.yml`, matching the
  memory contract.
- No new watcher / auditor workflow added (blocked by
  `mem://constraints/release-assets-publish-contract`).

## References

- `.lovable/cicd/issues/02-release-page-missing-built-assets.md`
- `.lovable/memory/features/release-pipeline-repo-url-agnostic.md`
- `.lovable/memory/constraints/release-assets-publish-contract.md`
- `.github/workflows/release.yml`