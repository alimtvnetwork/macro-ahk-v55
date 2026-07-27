# Command: the GIT TAG is the single source of truth for version

Status: active (supersedes the prior "version.json is the single source of truth" rule)
Created: 2026-07-20
Revised: 2026-07-27
Scope: entire repo, all packages, all scripts, all workflows

## Verbatim

"The version must be picked from the tag release. Whatever the tag is created
should automatically take that. It does not have to put anything fixated inside
somewhere. There is no need to have the version on top, like version.json to
have the latest release version. It should get it from the tag."

## Rules

1. The GIT TAG `vX.Y.Z` is the ONLY source of truth for the release version.
   Humans never hand-edit a version literal anywhere in the repo.
2. `version.json` at the repo root is a build-time artifact regenerated from
   the tag by `scripts/write-version-from-tag.mjs`. Its committed value is a
   placeholder (`0.0.0-dev`); CI overwrites it during every build. It is NOT
   the source of truth and MUST NOT be edited to declare a release.
3. Every consumer that needs the version (manifest.json, package.json, shared
   version modules, install-script pins, changelog headings) MUST resolve the
   version through one of:
   - `$VERSION` env injected by the workflow (tag-derived), or
   - `scripts/write-version-from-tag.mjs` (which resolves from env, then
     `GITHUB_REF_NAME`, then `git describe --tags --abbrev=0`, then
     `0.0.0-dev` as a last-resort local-dev fallback).
   Reading `version.json` after `prebuild` still works: the value is fresh
   because the script regenerated it.
4. Release ceremony reduces to: `git tag vX.Y.Z && git push origin vX.Y.Z`.
   No file edit is required. The tag triggers `.github/workflows/release.yml`,
   which regenerates `version.json` from the tag and builds every asset.
5. Downstream stale-version scripts are forbidden. If a downstream pin drifts
   it means someone read `version.json` before `prebuild` or hand-edited a
   version literal; fix the reader, don't add a linter.
6. Any new file that embeds the version MUST resolve it via the shared
   version modules (`src/shared/version.ts` / `standalone-scripts/shared-version.ts`)
   or via the injected `$VERSION` env, never from a copied literal.

## Rationale

The previous rule ("`version.json` is the single pin, humans edit it") shipped
`v5.12.1` as an empty release page: the tag was pushed via `.gitmap` but
`version.json` still said `5.12.0`, so `release.yml → setup` fataled and
every build/release job was skipped. The tag was authoritative anyway
(GitHub already had it), so making the tag the source-of-truth eliminates
the entire drift class. See `.lovable/cicd/issues/03-release-page-empty-v5-12-1-version-json-drift.md`.
