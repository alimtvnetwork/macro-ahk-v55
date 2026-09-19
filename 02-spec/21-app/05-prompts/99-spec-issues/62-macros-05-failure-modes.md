# Audit — macros/05-failure-modes.md
**Audited:** 2026-06-02  · 113 lines
## Findings
- **C1** Missing metadata header.
- **C15 Bare fences (2).**
- **C8** Must `Mirrors: mem://standards/verbose-logging-and-failure-diagnostics` (Core failure-log schema).
- **C27 Reason enum** — Reasons named ad-hoc in prose; should be a single table aligned with `observability/02-failure-log-schema.md`.
- **C13** Duplicates failure subsections embedded in `01-step-kinds.md`, `03-audit-artifacts.md`, `04-loop-and-score.md`. This doc should be the single source.
- **C28** No test fixture per failure path.
## Severity
**Critical.** Failure taxonomy is the contract between engine + UI + webhook + tests. Currently the de-facto canonical doc but not declared as such.
## Fix order
1. Declare canonical (`Supersedes:` from sibling docs' failure sections).
2. Build authoritative Reason-code table mirroring `observability/02`.
3. `Mirrors:` Core memory.
4. Add fixture pointers.
