# Audit — macros/02-run-model.md
**Audited:** 2026-06-02  · 78 lines
## Findings
- **C1** Missing metadata header.
- **C15 Bare fences (4).**
- **C10/C26** Duplicates `engine/02-resume-after-sw-restart.md`; both claim authority on `runId` semantics. No `Supersedes:` chain.
- **C27** Resume verdicts not enumerated.
- **C8** No `Mirrors: mem://architecture/extension-lifecycle` (6-phase model) — natural alignment missing.
## Severity
High. `runId` is the cross-cutting identifier; dual-source-of-truth = bugs.
## Fix order
1. Declare ONE owner (recommend this top-level doc); engine doc becomes implementation detail.
2. `Mirrors:` extension-lifecycle memory.
3. Enumerate resume verdicts.
