# CI/CD Asset Inclusion and Release Fix

## slug
Cicd-Asset-Inclusion-And-Release-Fix

## User Request (Verbatim)

# CI/CD Asset Inclusion and Release Fix: high priority instruction, non-negotiable task

CI/CD does not contain the assets like the `gitmap` and Antigravity Tools Manager. Can you please check the release page what went wrong, and fix it like `gitmap` or Antigravity Tools Manager? Can you please do that and make a release bump minor and do a release again? Also, in this case, we need to have the Chrome extension and other stuff, which you can find in the 6.99 or 6.25, I guess. Okay. You can check and compare and find it, find the root cause and fix it, and also write the root cause so that no way I make the same mistake again. Is it clear?

## slug: cicd-asset-inclusion-and-release-fix

# Actionable Items Must Follow Non-Negotiable

1. Write spec under 02-spec/21-app/cicd-asset-inclusion-and-release-fix/ and enqueue plan task in .ai-memory/plans/cicd-asset-inclusion-and-release-fix.md (subtasks in .ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/) first
2. Search codebase exclusively via GitMap (gitmap aum search, gitmap find, gitmap cat, gitmap ps, gitmap py, gitmap llm train); TOTAL BAN on rg, ripgrep, grep, git grep, Select-String
3. Strictly use relative Git paths (02-spec/..., .ai-memory/..., cmd/...); only add the relative paths, never add the absolute path during your work, and ensure this is respected on the release page and in release notes as well
4. Use `gitmap` AI agents to enter data
5. Task completion includes committing and pushing to Git
6. Check the release page to identify what went wrong with the asset inclusion for `gitmap` and Antigravity Tools Manager.
7. Fix the issue by ensuring the assets are included correctly, similar to `gitmap` or Antigravity Tools Manager.
8. Perform a minor release bump and execute the release again.
9. Ensure the Chrome extension and other necessary components are included, referencing versions 6.99 or 6.25 as needed.
10. Identify and document the root cause of the issue to prevent recurrence.

## Must follow and spawn agent using

`[execute-parent-task-with-n-steps-v6](file;.agents/skills/execute-parent-task-with-n-steps-v6)`

## Additional Instructions

- [/plan](slashCommand;plan) first before doing the work to reduce the credits.
- [/learn](slashCommand;learn) from `[gitmap](file;.agents/skills/gitmap)` skill to leverage GitMap high-speed search, toolchain discovery, and caching.
- Only add the relative paths, never add the absolute path during your work; this should be respected on the release page and in release notes as well.

## Confirmed Task Breakdown

### Task-01: Release forensics — what broke asset inclusion
- **Understood:** [YES] — v6.99.0 has 18 assets (healthy); v6.100.0 and every 6.101.x since have zero. The regression is between those tags; the readme itself documents a v6.100.0 "Release Trigger Cleanup and Published-Asset Gate" pipeline change as the prime suspect.
- **Actionable Scope:** Diff `.github/workflows/release.yml` / `tag-and-release.yml` and related build/packaging scripts between v6.99.0 and v6.100.0; identify exactly why assets stopped being produced or uploaded; write RCA doc.
- **Target Files / Area:** `.github/workflows/`, `scripts/*release*`, `scripts/*zip*`, packaging steps.

### Task-02: Fix the release pipeline
- **Understood:** [YES] — Repair the workflow/scripts so every asset in the v6.99.0 manifest is produced and attached again.
- **Actionable Scope:** Minimal diff to workflows/build scripts; targeted verification of the fixed steps (file-scoped reruns; no full local release build unless file-scoped).
- **Target Files / Area:** files named by Task-01's RCA.

### Task-03: Minor bump + re-release with full assets
- **Understood:** [YES] — Explicit user order: minor bump (6.101.x → 6.102.0), then cut the release and confirm the release page shows the full asset set.
- **Actionable Scope:** Run the repo's canonical bump flow, push tag, let the Release workflow run, verify assets via `gh release view`; iterate on failures until the asset manifest matches.
- **Target Files / Area:** version sources (`scripts/bump-version.mjs`, `write-version-from-tag.mjs`, `manifest.json` sync), release notes.

### Task-04: Prevention doc — never again
- **Understood:** [YES] — The user wants the RCA written down as a standing prevention guide: what went wrong, the exact mistake pattern, and the checks that prevent recurrence.
- **Actionable Scope:** Lead-authored doc `02-spec/21-app/cicd-asset-inclusion-and-release-fix/release-asset-rca.md` with mistake pattern, detection checklist, and CI gate recommendation.
- **Target Files / Area:** spec dir only.

## Ground Truth (verified against GitHub, 2026-10-15)

- `v6.99.0` (healthy, 18 assets): marco-extension-v6.99.0.zip, macro-controller-v6.99.0.zip, marco-sdk-v6.99.0.zip, xpath-v6.99.0.zip, payment-banner-hider-v6.99.0.zip, lovable-common/-dashboard/-owner-switch/-user-add-v6.99.0.zip, prompts-v6.99.0.zip, install.ps1, install.sh, clone-repo.ps1, download-extension.ps1, checksums.txt, changelog.md, RELEASE_NOTES.md, VERSION.txt.
- `v6.100.0`: 0 assets. `v6.101.18` (latest): 0 assets.
- `v6.25.0`: does not exist as a release.
- Reference healthy pipelines: gitmap-v28 `v6.551.0` = 16 assets; AGM releases healthy at 19 assets (v4.162.0–v4.164.0 era).
- Readme documents v6.100.0 "Release Trigger Cleanup and Published-Asset Gate": release pipeline previously zipped a legacy `chrome-extension/dist/` subfolder that no longer existed; workflow changed to zip `chrome-extension/` directly with a fail-fast gate if the zip is missing or < 10 KiB.

## Acceptance Criteria

1. New release (minor bump → 6.102.0) exists on GitHub with the full v6.99.0-equivalent asset manifest (Chrome extension zip + standalone zips + install scripts + checksums + notes + VERSION.txt).
2. RCA doc written: root cause identified, mistake pattern named, prevention checklist included.
3. One atomic GitMap commit + push for the fix work; the release tag pushed separately per the repo's release flow; CI green on all of it.
4. No secrets, no absolute paths, lowercase filenames.

## Constraints

- GitMap search primacy; TOTAL BAN on rg/ripgrep/grep/git grep/Select-String/Get-ChildItem -Recurse/findstr.
- Strict relative git paths everywhere, including release-notes text.
- R10 (no releases) is LIFTED for this run only by the user's explicit order: minor bump + release is commanded. Version bump applies to the release only; no extra changelog edits beyond what the release flow generates.
- Release assets via `gh release upload` are EXEMPT from the zero-storage rule (AGENTS.md §7 Release Assets Exemption; same as gitmap/AGM). `actions/upload-artifact` for routine diagnostics stays banned.
- Do not redesign the pipeline beyond the minimal green-making fix; report structural issues as `Follow-ups:`.
- Never cut the bump/release while another Release run is in flight; check first.
- Workers never run git commands; lead does the single atomic commit and the release-tag push.
