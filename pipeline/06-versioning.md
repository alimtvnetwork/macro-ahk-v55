# 06 — Versioning

## Version Format

`MAJOR.MINOR.PATCH` — e.g. `2.119.0`

- **MAJOR**: Breaking changes (rare)
- **MINOR**: New features, refactors, non-trivial changes
- **PATCH**: Bug fixes only

## Policy

- **Every code change** must bump at least the minor version
- **The git tag (`vX.Y.Z`) is the sole source of truth for the release version.**

## How to Bump

Do NOT edit `version.json` manually. Do NOT edit `manifest.json` or constants manually.

To trigger a release build and declare the version:
```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

The release workflow (`.github/workflows/release.yml`) automatically regenerates `version.json` from the tag using `scripts/write-version-from-tag.mjs`, and the build pipeline propagates it to all required files. See `.lovable/how-to-release.md` for the full canonical checklist.
