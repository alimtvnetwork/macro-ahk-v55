# Audit — C29 Missing Planned Subfolders (CRITICAL)
**Audited:** 2026-06-02
**Scope shortcut:** Subsumes planned audit tasks 56–85.
## Finding
Audit plan Phases 5–6 (tasks 56–85) presume four subfolders that DO NOT EXIST in `spec/21-app/05-prompts/macros/`:
| Planned folder | Planned doc count | Status |
|---|---|---|
| `json/` | 10 (`00`–`09`) | **MISSING** |
| `ui/` | 10 (`00`–`09`) | **MISSING** |
| `macro-prompts/` | 8 (`00`–`07`) | **MISSING** |
| `variables/` | 2+ | **MISSING** |
Total: **30 planned docs absent.**
## Cross-impact
Many sibling docs reference these folders as canonical homes for:
- JSON schema definitions (referenced by `02-failure-log-schema.md`, `examples/02-export-import-roundtrip.md`)
- UI surface taxonomy (referenced by `observability/04-ui-error-surface.md`)
- Macro-prompt authoring guide (`examples/04-macro-prompt-authoring.md` claims `macro-prompts/00-overview.md` is canonical)
- Variable inventory (`examples/03-variable-driven-audit.md` references `${ScoreFloor}`, `${MaxIters}`)
Every reference becomes a dangling link (compounds **C8 cross-reference rot**, **C12 orphan**, **C27 enum gap**).
## Severity
**Critical.** ~30% of the planned spec surface is missing. A blind AI handed this folder cannot:
- Validate exported JSON (no schema folder)
- Render a compliant UI error surface (no taxonomy)
- Author a macro-prompt (no authoring guide other than the duplicative example)
- Resolve any `${Variable}` placeholder (no inventory)
## Recommended fix
1. Either CREATE all four folders with at least `00-overview.md` + the highest-priority docs, OR
2. EXCISE references to them from existing docs and consolidate content into the 8 top-level `00-concept.md` … `07-permissions-and-scope.md` plus `folder-layout/`.
Recommend **Option 1** (create) because the existing docs already lean on these references.
## Plan reconciliation
Audit tasks 56–85 are collapsed into this single finding. Continuing audit will:
- Skip per-doc enumeration of non-existent files.
- Pick up at task 86 (memory cross-checks) on the next `next` round.
