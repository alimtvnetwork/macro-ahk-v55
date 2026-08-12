# Version.json as the single source of truth, CI/CD propagates everywhere

Slug: version-json-single-source-of-truth
Steps: 10
Status: pending
Created: 2026-07-20

## Context

Releases currently require a human to hand-edit or locally-run scripts against
~14 files to keep the version in sync. This has caused repeated CI failures
(release-readiness, audit-releases, latest.json vs version.json, asset manifest
diffs) and user frustration. This plan makes `version.json` the ONLY file a
human edits for a release, and moves ALL propagation into CI/CD.

Captured command: ../../spec/commands/05-version-json-single-source-of-truth.md
Captured issue:   ../../issues/open/09-version-scattered-across-many-files.md

Related prior work now superseded / to be simplified:
- `scripts/update-stale-version-refs.mjs` (becomes CI-only)
- `scripts/check-version-sync.mjs` (becomes CI-only, non-blocking locally)
- `.github/workflows/release.yml`, `ci.yml`

## Steps

1. Inventory every file that currently embeds the version literal. Produce
   `.lovable/plans/subtasks/29-version-json-single-source-of-truth/01-inventory.md`
   listing each path, the exact pattern, and whether it should be (a) rewritten
   by CI, or (b) refactored to read `version.json` at build/runtime.
   See ./subtasks/29-version-json-single-source-of-truth/01-inventory.md
2. Refactor runtime consumers to import from a single module
   `src/shared/version.ts` that re-exports `version` from `version.json`
   (`import pkg from "../../version.json"`). Remove hardcoded strings in
   `src/shared/constants.ts` and equivalents.
3. Generate `manifest.json`'s `version` field at build time from `version.json`
   via a Vite plugin (or a `prebuild` script that writes `manifest.json`
   `version` in place). Manifest version pin is no longer human-edited.
4. Convert `scripts/update-stale-version-refs.mjs` into a CI-only propagator:
   it rewrites readmes, install scripts, prompt bodies, and any doc pins from
   `version.json`. Add a `--check` mode for CI verification only; developers
   never run it locally.
5. Add `.github/workflows/version-propagate.yml`: on push to any branch that
   modifies `version.json`, run the propagator, commit the rewritten files
   back with `[skip ci]`, and push. This is the ONLY writer of downstream
   version pins.
   See ./subtasks/29-version-json-single-source-of-truth/02-propagate-workflow.md
6. Rework `.gitmap/release/latest.json` and `.gitmap/release/v<VER>.json` to be
   CI-generated from `version.json` during the release workflow. Remove the
   requirement for a human to author them; delete any check that fails when
   they drift from `version.json`.
7. Remove every remaining CI gate that fails on version drift, missing asset
   manifests, or latest.json mismatch. Replace with best-effort auto-repair
   inside the release workflow (already partly done); ensure NO workflow
   exits non-zero for these categories.
   See ./subtasks/29-version-json-single-source-of-truth/03-ci-gate-removal.md
8. Update the release ceremony docs (`.lovable/memory/workflow/release-ceremony.md`,
   `19-release-runbook-and-failure-modes.md`, root readme "Release" section) to
   the new one-step flow: "Edit `version.json`. Commit. Push. Done." Remove all
   references to running local scripts.
9. Add `mem://workflow/version-json-single-source-of-truth` memory entry and a
   Core rule in `mem://index.md` so future turns never reintroduce hand-edited
   downstream pins or local-run propagators.
10. Verification pass: bump `version.json` to a throwaway patch in a test
    branch, push, observe CI propagates every file, generates release
    descriptors, and produces a green build with no manual intervention.
    Document the observed run in
    `.lovable/plans/subtasks/29-version-json-single-source-of-truth/04-dry-run.md`
    before moving the plan to `completed/`.

## Verification

- `git grep` for the current version literal returns only `version.json` and
  CI-generated artifacts (or files rewritten by the propagator on the same
  commit).
- Bumping `version.json` alone, with no other file changes, produces a green
  CI run and a valid release.
- No workflow references `check-release-readiness.mjs` or fails on
  latest.json / asset-manifest drift.
- New memory rule present and indexed.

## Appended from prior pending tasks

Existing pending plans remain independent and are NOT rolled into this plan:
- 11-prompts-import-export-section
- 13-per-project-chat-submit-tracker
- 22-prompt-library-test-coverage-50
- 23-prompt-library-relocate-and-light-mode
- 24-eslint-warnings-cleanup-30
- 25-eslint-cleanup-continuation-30
