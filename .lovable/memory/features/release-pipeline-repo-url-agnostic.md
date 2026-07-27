---
name: Release pipeline is repo-URL agnostic
description: How the release pipeline auto-heals on repo rename/fork, why hardcoded owner/repo literals kill the release job, and the safe repo-rename checklist.
type: feature
---

# Release pipeline: repo-URL agnostic contract

## Why this exists

`v5.11.0` shipped a broken GitHub release page: only GitHub's auto-source
archives, no built ZIPs, and a bare `Release v5.11.0` body. Root cause was a
single hardcoded string:

- The active repo had been renamed to `alimtvnetwork/macro-ahk-v53`.
- `scripts/installer-contract.json` -> `repo.default` still said
  `alimtvnetwork/macro-ahk-v55`.
- `scripts/check-installer-contract.mjs` runs in `.github/workflows/release.yml`
  job `setup`, and failed the literal comparison.
- `setup` failing skipped every `build-*` job, which skipped the `release`
  job. Only the early `create-release-page` job succeeded, which is why the
  page existed but had a placeholder body and no assets.

**Rule:** a repo rename must never brick the release pipeline. Every part of
CI that needs `owner/repo` reads it from `GITHUB_REPOSITORY` (in Actions) or
the local git remote (elsewhere), not from a checked-in literal.

## The contract

1. `scripts/resolve-repo-slug.mjs` is the single resolver. Precedence:
   `GITHUB_REPOSITORY` env, then `MARCO_DEFAULT_REPO` env, then
   `git remote get-url origin`, then `installer-contract.json` -> `repo.fallback`.
2. `scripts/installer-contract.json` has `repo.autoResolve: true`. When set,
   `scripts/check-installer-contract.mjs` overrides `repo.default` with the
   resolved slug in memory and downgrades any residual "installer-constants
   fallback disagrees with contract" mismatches from failures to stderr
   notices, so a stale literal cannot kill CI.
3. `scripts/sync-repo-slug.mjs` is called from `.github/workflows/release.yml`
   in `setup` BEFORE the contract check. It rewrites every hardcoded
   `alimtvnetwork/macro-ahk-v*` or `aukgit/macro-ahk-v*` occurrence in
   `scripts/installer-*.{json,sh,ps1}` and `scripts/install*.{sh,ps1}` to
   the resolved slug. Idempotent: no-op when already in sync.
4. `.github/workflows/spec-gates.yml` -> `verify-no-hardcoded-repo` fails CI
   if any tracked file (outside historical RCA docs, spec examples, and the
   changelog) reintroduces such a literal.
5. `release.yml` also triggers on `release: types: [created]`, so a release
   page created out-of-band (e.g. by `.gitmap`) still runs the full build.
6. On any release-job failure, an `on-failure` step appends the failing job
   URLs to the release body, so future empty releases are self-explaining
   from the page itself.

## Safe rename checklist (for developers)

1. Rename the repository on GitHub (or fork under a new owner).
2. Update the local git remote: `git remote set-url origin <new-url>`.
3. Push a new tag (`git tag vX.Y.Z && git push origin vX.Y.Z`) or trigger
   `release.yml` via `workflow_dispatch`.
4. Watch the Actions run: `setup` calls `sync-repo-slug.mjs` first and every
   downstream job sees the new slug.
5. If `verify-no-hardcoded-repo` flags a residual literal in tracked
   sources, open a small PR that runs `node scripts/sync-repo-slug.mjs`
   locally and commits the diff.

## What NOT to do

- Do not hardcode `alimtvnetwork/macro-ahk-v??` or `aukgit/macro-ahk-v??` in
  new source files, workflows, docs, or install scripts.
- Do not remove `repo.autoResolve` from `installer-contract.json`. That
  reintroduces the v5.11.0 failure class.
- Do not delete the early `create-release-page` job. It guarantees the tag
  page exists even if `setup` fails, and the `on-failure` step relies on it.

## References

- `.lovable/cicd/issues/02-release-page-missing-built-assets.md`
- `.lovable/cicd/issues/12-stale-repo-owner-ci-report-links.md`
- `scripts/resolve-repo-slug.mjs`, `scripts/sync-repo-slug.mjs`
- `scripts/check-installer-contract.mjs` (autoResolve branch)
- `.github/workflows/release.yml` (setup: Resolve repo slug)
- `.github/workflows/spec-gates.yml` (verify-no-hardcoded-repo)