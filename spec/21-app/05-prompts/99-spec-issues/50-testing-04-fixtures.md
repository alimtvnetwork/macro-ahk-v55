# Audit — testing/04-fixtures.md
**Audited:** 2026-06-02  · 56 lines (largest in `testing/`)
## Findings
- **C1** Missing metadata header.
- **C15 Bare fences (2)** — JSON fixtures untagged.
- **C28** Fixture *location* policy missing: `spec/fixtures/` vs `src/__fixtures__/` vs colocated `__tests__/fixtures/` undecided.
- **C27** Schema of each fixture (Macro, Variable, RunEvent) declared informally; no JSON-Schema or TypeScript type pointer.
- **C8** No link to `engine/06-message-contract.md` (canonical shapes).
- **C12 Orphan risk** — referenced by no other doc.
## Severity
High. Fixture path ambiguity blocks both unit + e2e implementation.
## Fix order
1. Pick canonical fixture root.
2. Link each fixture shape to its owning message-contract section.
3. Language-tag fences + metadata header.
