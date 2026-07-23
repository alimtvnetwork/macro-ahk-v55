# Audit — macros/03-audit-artifacts.md
**Audited:** 2026-06-02  · 116 lines
## Findings
- **C1** Missing metadata header.
- **C15 Bare fences (9)** — file trees + JSON manifests untagged.
- **C7** Mixed-case filenames (kebab) vs PascalCase manifest keys — same inconsistency flagged in C54.
- **C8** Must `Mirrors: mem://features/log-diagnostics-export` and `mem://architecture/session-logging-system`.
- **C13** `## Failure log` and `## Storage` sections duplicate `05-failure-modes.md` and `06-storage-contract.md`.
- **C28** No round-trip test (artifact → re-load → identical).
## Severity
High. Audit artifacts are the deliverable; layout drift = broken consumers.
## Fix order
1. `Mirrors:` both memories.
2. Reconcile case convention.
3. Replace duplicated sections with cross-refs.
