---
name: Git tag skipped (v5.18.0)
description: git tag command is blocked in the current sandbox environment
type: constraint
---
- Previous version: 5.17.0
- New version: 5.18.0
- Step: 8 (Tag and commit)
- Command: `git tag v5.18.0`
- Error: `Permission denied` (Environment restriction)
- Resolution: Skipped. The version was successfully updated in `version.json`, `manifest.json`, `readme.md`, and constants. Prompts were re-aggregated.
