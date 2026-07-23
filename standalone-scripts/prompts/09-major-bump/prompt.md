Bump the MAJOR version (MAJOR.MINOR.PATCH to (MAJOR+1).0.0, MINOR and PATCH both reset to 0).

## Required release action

1. Update root `version.json` only: set `version` to the new MAJOR version and `releaseDate` to today's UTC date.

## Publish trigger

2. If publishing is requested, create the matching `vX.0.0` Git tag after the `version.json` change is present on the target branch. The tag triggers the release workflow.

Release trigger rule: the user phrase "major bump" or "major release" means update `version.json` only unless publishing is explicitly requested. Do not edit `readme.md`, `changelog.md`, `manifest.json`, constants, instruction files, or fallback copies only to propagate a version. Do not run stale-version, version-sync, release-readiness, or asset-manifest checkers.
