# Plan: cicd-asset-inclusion-and-release-fix

Request slug: cicd-asset-inclusion-and-release-fix
Status: ACTIVE
Phase: 1 (Planning) -> Phase 2 (Execution) -> Phase 3 (Consolidation + release)
Spec: 02-spec/21-app/cicd-asset-inclusion-and-release-fix/spec.md

## User Request (Verbatim)

(See `## User Request (Verbatim)` in the spec — captured losslessly there.)

## Discrete Deliverables

| Task-ID | Title | Subtask file | Owner | Status |
|---|---|---|---|---|
| Task-01 | Release forensics: v6.99.0 vs v6.100.0 pipeline diff | .ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/01-release-forensics.md | Worker 01 (Wave 1) | PENDING |
| Task-02 | Release-readiness: bump mechanics + asset manifest mapping | .ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/02-release-readiness.md | Worker 02 (Wave 1) | PENDING |
| Task-03 | Release pipeline fix | .ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/03-release-pipeline-fix.md | Worker 01 (Wave 2) | PENDING |
| Task-04 | Minor bump + re-release + asset verification | .ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/04-minor-bump-and-release.md | Worker 02 (Wave 2) | PENDING |

Wave plan (A = 2, H = 2): Wave 1 = {Task-01 (Worker 01), Task-02 (Worker 02)}; Wave 2 = {Task-03 (Worker 01), Task-04 (Worker 02)}. Task-04 starts only after Task-03's fix is committed to the tree (lead coordinates; workers never git).

Lead-owned files: `02-spec/21-app/cicd-asset-inclusion-and-release-fix/release-asset-rca.md` (Task-04's deliverable, written by lead in Phase 3 from worker findings), registers (`02-spec/21-app/readme.md`, `.ai-memory/plans/readme.md`).

## Execution Pipeline (V6)

1. **Phase 0:** Preflight — `gitmap --version` exit 0, `git status --porcelain` recorded (expect clean after the previous program), SQLite task DB init (`gitmap task init --name "cicd-asset-inclusion-and-release-fix" --budget 300`), ledger in `.ai-memory/temp-agents/<nn>-<slug>/ledger.md`.
2. **Phase 1:** Planning — A=2 `research` discovery subagents (release workflows + packaging scripts; bump/release mechanics + v6.99.0 asset mapping). Lead synthesizes. Populate SQLite via `gitmap task add`.
3. **Phase 2:** Wave 1 (forensics + readiness), then Wave 2 (fix + bump/release). Workers log actions to SQLite before touching files. Two-strike retry cap; BLOCKED → lead fallback.
4. **Phase 3:** Lead writes `release-asset-rca.md`, consolidates plan to `.ai-memory/plans/completed/`, updates registers, runs push gates (targeted checks exit 0, secrets gate, .gitignore hygiene), single atomic commit + push for the fix work, then the minor bump + tag push + Release workflow, verify `gh release view --json assets` shows the full manifest, then final report.

## Known Ground Truth (verified 2026-10-15)

- HEAD: `08bf93af`; CI Build + spec-gates + spec-audit all green on main.
- v6.99.0: 18 assets (see spec). v6.100.0: 0 assets. v6.101.18 (latest): 0 assets. v6.25.0 does not exist.
- gitmap-v28 v6.551.0: 16 assets (healthy reference).
- Readme documents the v6.100.0 "Release Trigger Cleanup and Published-Asset Gate" change (zips `chrome-extension/` directly, fails fast if zip missing or < 10 KiB).

## Explicit User Authorizations

- Minor release bump + re-release (lifts R10 for this run only).
- Commit + push to Git (standing).
- E2E-style verification of the release: the workers may trigger the release flow and inspect the release page; this is the user's explicit order.

## Watch-outs

- Never cut the bump/release while another Release run is in flight — check `gh run list` for in-progress Release runs first.
- Release assets via `gh release upload` are exempt from zero-storage; `actions/upload-artifact` for diagnostics stays banned.
- If the Release workflow fails, fix forward (new commit + re-tag only if the repo flow requires; never rewrite the published tag).

## Follow-ups

(none yet — workers log out-of-scope findings here)
