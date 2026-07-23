# Audit — macros/07-permissions-and-scope.md
**Audited:** 2026-06-02  · 64 lines
## Findings
- **C1** Missing metadata header.
- **C15 Bare fences:** 0 — clean.
- **C8** Must `Mirrors: mem://constraints/skipped-folders` (read-only) and `guards/00-forbidden-writes.md`.
- **C13** Overlaps `guards/00-forbidden-writes.md` (same deny-list topic).
- **C27** Permission matrix (read / write / execute per folder) not tabulated.
- **C28** No CI lint rule pointer enforcing the scope.
## Severity
High. Permissions ambiguity = either over-broad write access (security risk) or false-positive blockers.
## Fix order
1. Build single permission matrix table.
2. `Mirrors:` skipped-folders + forbidden-writes guard.
3. Link CI lint enforcement.
