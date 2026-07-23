# Audit — observability/03-export-bundle.md
**Audited:** 2026-06-02  · 46 lines
## Findings
- **C1** Missing metadata header.
- **C15 Bare fences (4)** — directory trees + ZIP manifests untagged.
- **C8** Must `Mirrors: mem://features/log-diagnostics-export`; currently re-states bundle layout.
- **C27** File-naming convention partially given; PII redaction policy missing.
- **C28** No round-trip test (export → re-import) pointer; mirrors C38 gap.
- **C7** Mixed `kebab-case` filenames vs PascalCase manifest keys — inconsistency.
## Severity
High. Diagnostic bundles are the support pipeline; drift = unreadable bundles.
## Fix order
1. `Mirrors:` memory.
2. Declare PII redaction list.
3. Reconcile case convention with `instruction-dual-emit`.
