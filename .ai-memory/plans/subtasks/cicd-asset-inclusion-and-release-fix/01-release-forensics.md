# Task-01: Release Forensics — v6.99.0 vs v6.100.0 Pipeline Diff

Status: pending
Owner: Worker 01 (Wave 1)
Owned files: `.ai-memory/cicd/issues/cicd-asset-inclusion-and-release-fix.md` (RCA doc; worker authors, lead indexes).

## Objective

Find exactly why release assets stopped being attached after v6.99.0. v6.99.0 had 18 assets; v6.100.0 and all 6.101.x have zero.

## Steps

1. List the release workflow files: `gitmap lf .github/workflows` (release.yml, tag-and-release.yml, and any other release-related workflow).
2. Diff each release-related workflow between the two tags WITHOUT git commands — use `gh` to fetch file contents at tags: `gh api repos/alimtvnetwork/macro-ahk-v55/contents/.github/workflows/release.yml?ref=v6.99.0` and `?ref=v6.100.0`, then compare job/step by job. (Workers never run git commands; `gh api` reads are fine.)
3. Identify precisely what changed: the readme mentions a v6.100.0 "Release Trigger Cleanup and Published-Asset Gate" (zips `chrome-extension/` directly, fail-fast if the zip is missing or < 10 KiB). Determine: does the upload/publish job still run? Is it conditional on something that never fires? Did the trigger change (e.g. from tag push to workflow_dispatch)? Did the asset-glob paths break?
4. Trace each of the 18 v6.99.0 assets to its producing step and check whether that step still exists and can succeed on main today (paths, build outputs, zip commands in `scripts/`).
5. Cross-reference the gitmap-v28 release workflow (healthy, 16 assets on v6.551.0) only for the upload mechanism pattern — do not copy blindly.
6. Write the RCA to `.ai-memory/cicd/issues/cicd-asset-inclusion-and-release-fix.md`: failing runs/jobs, exact changed lines (file + tag), root cause, minimal fix plan naming exact files. Include a "Prevention" section draft (the mistake pattern + a check that would have caught it) for the lead's prevention doc.

## Search rules

GitMap only (`gitmap aum search`, `gitmap find`, `gitmap cat`, `gitmap lf`). TOTAL BAN on rg/ripgrep/grep/git grep/Select-String/findstr. No git commands at all.

## Output contract

Report JSON: `{ "task": "Task-01", "status": "DONE", "rootCause": "<one paragraph>", "changedFiles": ["<workflow file>@<tag>"], "fixPlan": ["<file to change> -> <what>"], "rcaDoc": "<relative path>", "assumptions": [], "blockers": [] }`.
