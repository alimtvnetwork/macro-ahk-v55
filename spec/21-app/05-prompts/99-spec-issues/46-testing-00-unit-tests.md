# Audit — testing/00-unit-tests.md
**Audited:** 2026-06-02  · 30 lines
## Findings
- **C1** Missing metadata header.
- **C5/C25** Uses reserved slot `00-` but is content, not an overview; folder lacks `00-overview.md`.
- **C28** No concrete test-file paths (e.g. `src/**/__tests__/*.unit.test.ts`); blind AI cannot locate.
- **C27** Mentions assertion helpers without enumeration; matcher inventory missing.
- **C8** No link to `mem://preferences/test-with-features`.
## Severity
High. Unit-test policy without paths/matchers is unimplementable.
## Fix order
1. Rename to `01-unit-tests.md`, create proper `00-overview.md`.
2. Add fixture/test path glob + matcher list.
3. Link Core memory.
