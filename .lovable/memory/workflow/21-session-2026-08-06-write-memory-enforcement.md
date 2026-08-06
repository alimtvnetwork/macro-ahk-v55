---
name: Session 2026-08-06 write-memory enforcement
description: Maximum enforcement v3.0 write-memory prompt implemented and applied.
type: preference
---

## Session Summary (2026-08-06)
- **Done:**
  - Updated `standalone-scripts/prompts/17-write-memory/prompt.md` and `.lovable/prompts/03-write-memory.md` to v3.0 (Maximum Enforcement).
  - Implemented the full `.lovable/` folder structure required by the new prompt.
  - Created missing index files: `suggestions/index.md`, `cicd-index.md`, `prompts/index.md`.
  - Created `rules.md` (consolidated prohibitions).
  - Captured missing specs for Workspace Move v2, Token Substitute Patch, and SQL Bridge.
  - Resolved case-sensitivity issue: `README.md` is `readme.md`.
  - Verified `memory/index.md` Core rules include the em dash ban.
- **Pending:**
  - Full audit of all `.lovable/memory/` files to ensure they follow the new topic-folder requirement (Phase 2 audit).
  - Syncing all prompt mirrors to ensure they are byte-identical.
- **Learned:**
  - The project uses a custom `readme.md` (lowercase) and has strict rules about no auto-updates to `readme.txt`.
  - Em dashes are strictly banned.
- **Wrong:**
  - The previous `write-memory` implementation was "sloppy" and left many orphans/root-level files.

## What next session should do first
1. Read `.lovable/what-to-read.md` (updated).
2. Continue with the pending audit of topic folders in `.lovable/memory/`.
3. Verify the next release follows the `how-to-release.md` checklist precisely.
