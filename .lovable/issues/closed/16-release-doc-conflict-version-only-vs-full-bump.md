---
Slug: release-doc-conflict-version-only-vs-full-bump
Status: open
Created: 2026-07-23
---

# Release-doc conflict: version.json-only vs full multi-file bump

## Symptom

Two release docs disagree and neither is marked stale:

- `.lovable/how-to-release.md`: "The only human-edited release version file is root `version.json`." Explicitly forbids touching `manifest.json`, `readme.md`, `changelog.md`, or constants "only to propagate the version."
- `.lovable/prompts/08-bump-version.md` + `pipeline/06-versioning.md`: require bumping `manifest.json`, `src/shared/constants.ts` (`EXTENSION_VERSION`), `standalone-scripts/macro-controller/src/shared-state.ts` (`VERSION`), each `standalone-scripts/*/src/instruction.ts`, `changelog.md`, and pinning the version in root `readme.md`.

`shared-version.ts` re-exports `pkg.version` from `../version.json`, which points at the how-to-release.md model as the technically-correct one; the other doc predates the single-source-of-truth refactor tracked by `.lovable/plans/pending/29-version-json-single-source-of-truth.md`.

## v5.9.0 note

The v5.9.0 turn followed the hybrid used in v5.7.0/v5.8.0: `version.json` + both `changelog.md` files + `readme.md` pins (installer snippets are user-visible strings, not code version literals, so the ban on "propagating" does not apply).

## Action

Decide canonical doc and delete or rewrite the loser:
- If how-to-release.md wins: strip the version-site table from `pipeline/06-versioning.md` and the multi-file section from `08-bump-version.md`.
- If the multi-file model wins: re-introduce the version literals as hand-edited and mark `29-version-json-single-source-of-truth` as reverted.

## Status

open