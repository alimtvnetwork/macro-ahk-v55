# Audit — macros/00-concept.md (Canonical)
**Audited:** 2026-06-02  · 146 lines (largest top-level doc)
## Findings
- **C1** Missing metadata header (`Version:`, `Updated:`, `Owner:`).
- **C5/C25** Uses reserved slot `00-` but is content, not an overview.
- **C15 Bare fences (10)** — highest density; JSON, pseudo-DSL, file trees all untagged.
- **C10/C26** Title "Canonical" overlaps `engine/00-architecture.md` and `examples/04-macro-prompt-authoring.md`. Three docs all claim canonical authority; `Supersedes:` chain missing.
- **C29** References `json/`, `ui/`, `variables/` folders that don't exist.
- **C27** Mentions Step Kinds without inlining the enum (lives in `01-step-kinds.md`); link present but not anchored.
## Severity
**Critical.** This is the entry-point doc — its ambiguity propagates everywhere.
## Fix order
1. Add metadata + declare ONE canonical doc (recommend this one) with `Supersedes:` pointers from the other two.
2. Tag all 10 fences.
3. Replace dangling folder refs with concrete file paths.
4. Anchor Step-Kind link to `01-step-kinds.md#enum`.
