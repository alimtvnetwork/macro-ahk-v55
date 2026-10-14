# Task-02: Release-Readiness — Bump Mechanics + Asset Manifest Mapping

Status: pending
Owner: Worker 02 (Wave 1)
Owned files: `.ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/02-readiness-report.md` (Worker 02 authors; NEW file, no collision).

## Objective

Map how a release is cut in this repo today, so the minor bump + re-release (Task-04) executes the canonical flow with zero improvisation.

## Steps

1. Read `scripts/bump-version.mjs` — what does a minor bump touch (package.json, version.json, manifest.json, installer constants, seed manifests)? List every file it writes.
2. Read `scripts/write-version-from-tag.mjs` and `scripts/sync-manifest-version.mjs` — confirm the tag is the single source of truth and what must stay in sync.
3. Determine the release trigger: which workflow creates the GitHub release and on what event (tag push matching `v*`? workflow_dispatch?). Check `release.yml` and `tag-and-release.yml` `on:` blocks.
4. Map each of the 18 v6.99.0 assets to its producing step/script (marco-extension zip, standalone zips, install.ps1/sh, checksums.txt, changelog.md, RELEASE_NOTES.md, VERSION.txt). Note any asset whose producing step is currently broken or missing.
5. Check for in-flight Release runs before Task-04: record the exact command the lead must run (`gh run list --repo alimtvnetwork/macro-ahk-v55 --workflow release.yml` or equivalent) and what "no run in flight" looks like.
6. Write findings to `.ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/02-readiness-report.md`: bump file list, release trigger, asset→step map, broken-asset list, pre-release gate checklist.

## Search rules

GitMap only. TOTAL BAN on rg/ripgrep/grep/git grep/Select-String/findstr. No git commands.

## Output contract

Report JSON: `{ "task": "Task-02", "status": "DONE", "bumpFiles": [...], "releaseTrigger": "<event>", "assetMap": { "<asset>": "<step/script>" }, "brokenAssets": [...], "report": "<relative path>", "assumptions": [], "blockers": [] }`.
