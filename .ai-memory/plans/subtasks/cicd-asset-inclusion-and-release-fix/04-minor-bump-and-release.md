# Task-04: Minor Bump + Re-Release + Asset Verification

Status: pending
Owner: Worker 02 (Wave 2) — preparation only; LEAD executes the actual git/tag/release commands (workers never run git; release tagging is lead-only).
Owned files: none for code — Worker 02 prepares the verified runbook and hands it to the lead.

## Objective

Prepare everything so the lead can cut the 6.102.0 minor release in one clean pass and verify the full asset manifest on the release page.

## Steps

1. Read Task-02's readiness report. Confirm the current version sources: `package.json` version, `version.json`, `manifest.json` version, and the latest tag (`v6.101.18`).
2. Verify no Release run is in flight: record the exact `gh run list` command and its current output for the lead.
3. Produce the lead runbook (report it in your final message AND write `.ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/04-release-runbook.md`):
   - Exact bump command for minor (`node scripts/bump-version.mjs minor` or the repo-canonical equivalent), and every file it changes.
   - Exact commit/push/tag/push-tag sequence (lead runs these; include the expected new tag `v6.102.0`).
   - Which workflow run to watch and how (`gitmap pipeline-ai status --json` / `gh run watch`), with the ETA-wait discipline (no rapid polling).
   - The asset verification command: `gh release view v6.102.0 --repo alimtvnetwork/macro-ahk-v55 --json assets --jq '.assets[].name'` and the expected 18-asset manifest.
   - Roll-forward rule if the Release workflow fails: fix forward, never rewrite the published tag.
4. Confirm the release-notes content source (what generates RELEASE_NOTES.md / changelog entries) so the release body is not empty.

## Constraints

- Worker 02 does NOT run any git, tag, bump, or release commands — preparation only. The lead executes.
- If any readiness check fails (e.g. a producing step from Task-03 is still broken), mark BLOCKED with the exact failure instead of handing the lead a broken runbook.

## Output contract

Report JSON: `{ "task": "Task-04", "status": "DONE", "runbook": "<relative path>", "expectedTag": "v6.102.0", "expectedAssets": ["<asset>", ...], "releaseInFlight": false, "assumptions": [], "blockers": [] }`.
