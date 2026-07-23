---
name: Latest release minimal policy
description: Release must sync live version pins, readme installs, changelog, lowercase markdown names, and issue logs.
type: constraint
---
Release publishing is intentionally controlled, but a release turn is not version-only.

Allowed release actions:
1. Edit `version.json`.
2. Sync every live version pin found by search.
3. Pin the new version in `readme.md` install snippets.
4. Add the top `changelog.md` entry.
5. Rename uppercase markdown filenames to lowercase.
6. Regenerate generated prompt bundles when prompt sources changed.
7. Log release failures under `.lovable/release/issues/`.
8. Create the matching `v*` Git tag when publishing is explicitly requested and the tool environment allows it.

Forbidden release automation:
1. No release demotion workflow.
2. No release recovery workflow.
3. No release watcher workflow.
4. No release asset readiness checker in CI/CD.
5. No asset-manifest generator or verifier in CI/CD.

Do not add `SKIP_TAGS`, historical version regex checks, disabled-auditor placeholders, or latest-release completeness gates.
