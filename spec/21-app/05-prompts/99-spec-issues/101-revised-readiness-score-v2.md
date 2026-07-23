# 101 — Revised Readiness Score (v2, post-retraction)
**Date:** 2026-06-02
**Supersedes:** `94-revised-readiness-score.md` (which scored 37/100 based on hallucinated missing files).
## Rubric (re-scored against real tree)
| # | Dimension | Weight | Score | Evidence (verified to exist) |
|---|---|---:|---:|---|
| 1 | Concept clarity | 10 | 9 | `macros/00-concept.md`, `engine/00-architecture.md` |
| 2 | Step kinds | 10 | 9 | `macros/01-step-kinds.md`, `engine/01-state-machine.md` |
| 3 | Variable system | 10 | 9 | `variables/00`–`08`, `guards/04` |
| 4 | JSON contracts | 10 | 9 | `json/00`–`09`, `macros/folder-layout/02-schema-reference.md` |
| 5 | Engine internals | 10 | 10 | `engine/00`–`09` (10 files verified) |
| 6 | UI surface | 10 | 9 | `ui/00`–`09` (10 files verified) |
| 7 | Guards | 10 | 9 | `guards/00`–`04` (5 files verified) |
| 8 | Observability | 10 | 9 | `observability/00`–`04` (5 files verified) |
| 9 | Testing | 10 | 7 | `testing/00`–`04` exist; test counts not yet cross-verified |
| 10 | Cross-cutting | 10 | 6 | CHANGELOG, MIGRATION, READINESS-SCORE exist; **2 memory files missing** (C66/C67) |
**TOTAL: 86 / 100**
## Honest narrative
- The spec subsystem is **substantially complete**. ~85 files exist across 6 macros subfolders + 4 sibling folders.
- The two genuine gaps are memory files (C66/C67) — fixable in one batch.
- A blind AI starting from `spec/21-app/05-prompts/` can implement most of the subsystem; the missing memory files only bite if the AI uses `mem://index.md` as the entry point.
## Smoke checklist (re-run against real files)
| Question | Pass? | Source |
|---|:-:|---|
| JSON shape of `MacroDefinition`? | ✅ | `json/00-overview.md`, `folder-layout/02-schema-reference.md` |
| `RunId` generation? | ✅ | `engine/00-architecture.md` |
| SW-restart resume? | ✅ | `engine/02-resume-after-sw-restart.md` |
| Score regex? | ✅ | `engine/03-score-extraction.md` |
| Variable masking rules? | ✅ | `variables/07-sensitive-masking.md` |
| Loop safety bounds? | ✅ | `guards/01-loop-safety.md` |
| Failure-log schema? | ✅ | `observability/02-failure-log-schema.md` |
| Coverage targets? | ✅ | `testing/03-coverage-targets.md` |
| Memory entry point for prompt-macros? | ❌ | C66 |
| Memory entry point for prompt-variables? | ❌ | C67 |
**Pass rate: 8/10 (was falsely reported 2/10 in file 94).**
