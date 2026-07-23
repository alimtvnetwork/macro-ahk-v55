---
name: Release ceremony
description: Canonical release flow. version.json is the only human-edited release version; publishing is an optional matching tag.
type: preference
---

# Release Ceremony

Triggered by the user saying `release`, `bump version`, `major bump`, `major release`, or typo variants. Default is a MINOR bump unless the user says MAJOR or PATCH. Never ask for confirmation, never open plan mode, never ask minor or patch.

## Required flow

1. Read the canonical version from `version.json`.
2. Compute the requested bump. MINOR: `X.Y.Z` to `X.(Y+1).0`. MAJOR: `X.Y.Z` to `(X+1).0.0`. PATCH: `X.Y.Z` to `X.Y.(Z+1)`.
3. State the previous and new version before editing.
4. Update only `version.json` (`version` and `releaseDate`).
5. Do not edit `manifest.json`, constants, instruction files, `readme.md`, `changelog.md`, fallback copies, or generated bundles only to propagate the version.
6. If publishing is explicitly requested, create the matching `v<version>` tag after the `version.json` change is present on the target branch.
7. Do not publish unless the user explicitly says publish, deploy, ship, or go live.

## Prompt maintenance rule

When the release prompt text is supplied or corrected, update both `standalone-scripts/prompts/22-release/prompt.md` and `.lovable/prompts/14-release.md` in the same turn. Keep the mirror body byte-identical and regenerate bundled prompts.

## Never

- Never do a version-only release when the user requested full release ceremony.
- Never manually propagate a release version into `manifest.json`.
- Never add stale-version, version-sync, release-readiness, readme-pin, changelog, or asset-manifest gates.
- Never leave uppercase markdown filenames.
- Never hide a skipped commit/tag step; log it as a release issue.
- Never auto-publish unless explicitly requested.
- Never use em dashes in user-facing output, changelog entries, prompt bodies, or release issue files.
