Bump the PATCH version (MAJOR.MINOR.PATCH to MAJOR.MINOR.(PATCH+1)).

Only use this prompt when the user explicitly says "patch bump" or "patch release". Otherwise a release trigger defaults to MINOR.

## Required release action

1. Update root `version.json` only: set `version` to the new PATCH version and `releaseDate` to today's UTC date.

## Publish trigger

2. If publishing is requested, create the matching `vX.Y.Z` Git tag after the `version.json` change is present on the target branch. The tag triggers the release workflow.

Release trigger rule: the user phrase "patch bump" or "patch release" means update `version.json` only unless publishing is explicitly requested. Do not edit `readme.md`, `changelog.md`, `manifest.json`, constants, instruction files, or fallback copies only to propagate a version. Do not run stale-version, version-sync, release-readiness, or asset-manifest checkers.
