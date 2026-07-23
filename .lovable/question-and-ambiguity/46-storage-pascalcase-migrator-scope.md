# 46 — chrome.storage.local PascalCase Migrator Scope

## Context
Plan task 2c-storage: "rewrite already-persisted projects on extension upgrade; bump storage schema version".

## Ambiguity
`StoredProject` in `src/shared/project-types.ts` is still camelCase (`schemaVersion`, `targetUrls`, `scripts`, etc.) and every consumer (UI, background, options) reads camelCase. A full key rewrite would cascade to ~50+ files and is out of scope for one slice.

## Options

### A. Framework + no-op v1 migrator (RECOMMENDED)
Add `marco_storage_schema_version` key + sequential migrator runner in `src/background/storage-migration.ts`. Register `v1` identity migration (no key changes). Run on boot before seeders. Bumps to `CURRENT_STORAGE_SCHEMA = 1`.
- **Pros**: Tiny, safe, unblocks future PascalCase migrations as discrete v2/v3 steps. Matches SQLite `schema-migration.ts` pattern.
- **Cons**: Doesn't itself rewrite keys.

### B. Full StoredProject PascalCase rewrite
Rename every field + update every consumer + write v1→v2 migrator.
- **Pros**: Completes Phase 2c-storage fully.
- **Cons**: Huge blast radius; high regression risk; would need its own multi-day plan.

### C. Defer entirely
Skip until UI consumers migrated.
- **Pros**: No risk.
- **Cons**: Plan item lingers.

## Decision
**Option A** — establish the framework now so future PascalCase rewrites are mechanical drop-ins. Keeps slice atomic and reversible.
