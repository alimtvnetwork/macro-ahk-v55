# Audit — macros/01-step-kinds.md
**Audited:** 2026-06-02  · 125 lines
## Findings
- **C1** Missing metadata header.
- **C15 Bare fences (2).**
- **C27 Enum completeness** — Step Kinds enumerated, but `StepKindId` integer mapping not consistently shown for every kind (Core memory references `StepKindId 4 = JsInline`; doc should mirror).
- **C8** No `Mirrors: mem://features/js-step-diagnostics` for JsInline section.
- **C28** No fixture path showing each kind in JSON form.
- **C13** Failure-handling subsections duplicate `05-failure-modes.md`.
## Severity
**Critical.** Step Kinds = the type system; gaps here = runtime errors.
## Fix order
1. Add `StepKindId` column to enum table.
2. `Mirrors:` JS-step memory.
3. Link to `05-failure-modes.md` instead of restating.
4. Metadata header.
