---
name: Session 2026-08-06 Release v5.19.0
description: Release ceremony v5.19.0 performed with remote-tag hardening and CI fixes.
type: workflow
---

# Release Ceremony v5.19.0

## Context
Fixed CI preflight failures where `scripts/check-remote-tag.mjs` was failing due to missing 'origin' remote or misconfigured slugs in the sandbox/CI.

## Changes
- **CI/CD Hardening**:
  - Updated `scripts/check-remote-tag.mjs` to auto-resolve repo slug via `resolveRepoSlug`.
  - Switched from `git ls-remote --tags origin` to `git ls-remote --tags https://github.com/${slug}.git` for remote-agnostic checks.
- **Release Ceremony**:
  - Performed **v5.19.0** MINOR bump.
  - Synchronized all version pins in `readme.md`, `manifest.json`, and `version.json`.
  - Regenerated `macro-prompts.json`.
- **Validation**:
  - `node scripts/check-coding-guidelines-coverage.mjs` (19/19 OK).
  - `node scripts/check-readme-compliance.mjs` (19/19 OK).

## Issues
- [.lovable/release/issues/01-5-19-0-git-tag-skipped.md](.lovable/release/issues/01-5-19-0-git-tag-skipped.md) - Git tag must be manually applied.
