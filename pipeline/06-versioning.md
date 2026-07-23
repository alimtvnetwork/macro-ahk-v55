# 06 — Versioning

## Version Format

`MAJOR.MINOR.PATCH` — e.g. `2.119.0`

- **MAJOR**: Breaking changes (rare)
- **MINOR**: New features, refactors, non-trivial changes
- **PATCH**: Bug fixes only

## Policy

- **Every code change** must bump at least the minor version
- **version.json is the release source of truth**

## Files That Carry the Version

| # | File | Format | Example |
|---|------|--------|---------|
| 1 | `chrome-extension/manifest.json` | `"version": "X.Y.Z"` | `"version": "2.119.0"` |
| 2 | `chrome-extension/manifest.json` | `"version_name": "X.Y.Z"` | `"version_name": "2.119.0"` |
| 3 | `src/shared/constants.ts` | `EXTENSION_VERSION = "X.Y.Z"` | `export const EXTENSION_VERSION = "2.119.0"` |
| 4 | `standalone-scripts/macro-controller/src/shared-state.ts` | `VERSION = 'X.Y.Z'` | `export const VERSION = '2.119.0'` |
| 5 | `standalone-scripts/macro-controller/src/instruction.ts` | `version: "X.Y.Z"` | `version: "2.119.0"` |
| 6 | `standalone-scripts/marco-sdk/src/instruction.ts` | `version: "X.Y.Z"` | `version: "2.119.0"` |
| 7 | `standalone-scripts/xpath/src/instruction.ts` | `version: "X.Y.Z"` | `version: "2.119.0"` |

## How to Bump

Edit `version.json` only. Do not run stale-version propagation scripts.

## Release Tag Convention

To trigger a release build:
```bash
git tag v2.119.0
git push origin v2.119.0
```

The release workflow reads the version from `version.json`.
