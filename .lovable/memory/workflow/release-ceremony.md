---
name: Release ceremony
description: Canonical release flow. version.json is the only human-edited release version; publishing is an optional matching tag.
type: preference
---

# Release Ceremony

Triggered by the user saying `release`, `bump version`, `major bump`, `major release`, or typo variants. Default is a MINOR bump unless the user says MAJOR or PATCH. Never ask for confirmation, never open plan mode, never ask minor or patch.

## Required flow

1. Read the current release version from the latest `v*` git tag
   (`git describe --tags --abbrev=0`). NEVER read `version.json` for this —
   it is a build-time artifact regenerated from the tag by
   `scripts/write-version-from-tag.mjs`.
2. Compute the requested bump. MINOR: `X.Y.Z` to `X.(Y+1).0`. MAJOR: `X.Y.Z`
   to `(X+1).0.0`. PATCH: `X.Y.Z` to `X.Y.(Z+1)`.
3. State the previous and new version.
4. Create the matching `v<new-version>` git tag on the release branch.
   That is the only action required for a release. Do NOT edit
   `version.json`, `manifest.json`, constants, instruction files,
   `readme.md`, `changelog.md`, fallback copies, or generated bundles to
   propagate the version.
5. Push the tag when publishing is requested. The tag push triggers
   `.github/workflows/release.yml`, which derives the version from the tag,
   regenerates `version.json` in-workflow, and builds/uploads all assets.
6. Do not publish (push the tag) unless the user explicitly says publish,
   deploy, ship, or go live.

## Prompt maintenance rule

When the release prompt text is supplied or corrected, update both `standalone-scripts/prompts/22-release/prompt.md` and `.lovable/prompts/14-release.md` in the same turn. Keep the mirror body byte-identical and regenerate bundled prompts.

## Never

- Never treat `version.json` as the source of the release version. The tag is.
- Never edit `version.json` to declare a release. Create the tag instead.
- Never manually propagate a release version into `manifest.json`.
- Never add stale-version, version-sync, release-readiness, readme-pin, changelog, or asset-manifest gates.
- Never leave uppercase markdown filenames.
- Never hide a skipped commit/tag step; log it as a release issue.
- Never auto-publish unless explicitly requested.
- Never use em dashes in user-facing output, changelog entries, prompt bodies, or release issue files.
