# Audit — macros/folder-layout/ (5 docs, batch)
**Audited:** 2026-06-02  · 349 lines total
**Files:** `00-overview.md`, `01-naming.md`, `02-schema-reference.md`, `03-aggregation.md`, `04-starter-macros.md`
## Findings (rolled up)
- **C1** All 5 files missing metadata headers.
- **C3** Good — `00-overview.md` exists (correct use of reserved slot, unlike most other subfolders).
- **C8** `02-schema-reference.md` is 108 lines (largest); this is the de-facto JSON schema doc that **C29** assumes lives in the missing `json/` folder. Recommend: move OR declare it canonical and remove the `json/` plan.
- **C7** `01-naming.md` defines naming rules but doesn't `Mirrors: mem://architecture/constant-naming-convention` or `mem://workflow/file-naming-convention`.
- **C13** `04-starter-macros.md` overlaps `examples/04-macro-prompt-authoring.md` — third "how to author" doc.
- **C27** `02-schema-reference.md` enumerates fields but doesn't declare schema version (links to `WEBHOOK_RESULT_SCHEMA_VERSION` precedent in `mem://features/webhook-result-schema-version` are absent).
- **C28** `03-aggregation.md` describes roll-up logic with no test fixture.
## Severity
High. This folder is well-structured but undersold — it actually fills the `json/` gap from C29 once relocated/relabeled.
## Fix order
1. Declare `folder-layout/02-schema-reference.md` as the canonical JSON schema doc; drop `json/` from the plan.
2. `Mirrors:` naming-convention memories.
3. Add `SchemaVersion` field + bump policy.
4. Consolidate "how to author" docs (C40 + here + C57).
5. Metadata headers on all 5.
