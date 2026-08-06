# Changelog

## [v5.19.0] 2026-08-06 CI/CD Recovery and Remote Tag Hardening

### Fixed
- Hardened `scripts/check-remote-tag.mjs` to be remote-agnostic: it now auto-resolves the repository slug and uses the full GitHub URL for `ls-remote` checks, preventing failures when the 'origin' remote is missing or misconfigured in limited CI environments.
- Synchronized all version pin sites in `readme.md` to v5.19.0.
- Regenerated `macro-prompts.json` and updated `manifest.json` version.
- Verified coding guidelines and root README compliance.

### Added
- Performed **v5.19.0** MINOR bump ceremony.
- Logged `.lovable/release/issues/01-5-19-0-git-tag-skipped.md` for manual git tag requirement.

## [v5.18.0] 2026-08-06 fix cicd for E2E · Playwright
...keep existing content...