# CI/CD Issue 02 — Release page missing built assets (only tag + source archives)

## Pipeline / Workflow

`.github/workflows/release.yml` (and supporting `.github/workflows/audit-releases.yml`)

## Description

A GitHub release tag (`vX.Y.Z`) was created, but the corresponding **Release page** contained only GitHub's auto-generated source code archives — no `marco-extension-*.zip`, no installer scripts, no checksums — and the release-notes/changelog body was empty or repeated unchanged content.

## First Seen

- Reported: 2026-05-18, version `v2.250.0`
- Symptom: Release page existed but had zero uploaded assets and no diff in the notes.

## Root Cause

Three independent defects in `release.yml`:

1. **Wrong checkout ref on replay** — `actions/checkout@v4` used the default workflow ref. On `workflow_dispatch` recovery the source tree did not match the requested tag, so packaging produced unexpected output (or none).
2. **Empty changelog range** — `PREV_TAG=$(git tag --sort=-version:refname | head -1)` selected the **current** tag, making `${PREV_TAG}..HEAD` an empty range; the release body collapsed to headers only.
3. **No required-asset gate** — packaging errors did not block `softprops/action-gh-release`, so a partial run could still publish a release page with missing ZIPs.

## Status

✅ Resolved — 2026-05-18

## Fix

- `setup` job now outputs `ref` (validated for `workflow_dispatch`, derived from `GITHUB_REF` otherwise). Every downstream `actions/checkout@v4` uses `ref: ${{ needs.setup.outputs.ref }}`.
- `PREV_TAG` now excludes the current `${VER}` so the range is always `previous..HEAD`.
- New **Verify required release assets** step runs before `softprops/action-gh-release` and fails the job if any required ZIP/installer/checksum/notes file is missing or suspiciously small.
- New `.github/workflows/audit-releases.yml` (scheduled weekly + `workflow_dispatch`) audits every published `v*` release and flags any missing assets.
- New memory rule: `mem://constraints/release-assets-publish-contract`.

## Prevention

- Asset-presence verification gates publication.
- Scheduled audit workflow catches drift on existing releases.
- Plan/spec docs (`plan.md` Step 1–8, `spec/.../release-procedure.md`, `pipeline/03-release-workflow.md`) updated.

## References

- `plan.md` → "Release Page CI/CD Hardening Plan — 8 Steps"
- `mem://constraints/release-assets-publish-contract`
- `spec/22-app-issues/95-release-page-missing-built-assets-rca.md`
- `.github/workflows/release.yml`, `.github/workflows/audit-releases.yml`
