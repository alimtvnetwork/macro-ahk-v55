# Audit — testing/01-component-tests.md
**Audited:** 2026-06-02  · 31 lines
## Findings
- **C1** Missing metadata header.
- **C8** No reference to the 2026-05-25 lift of the React-component-test ban (`mem://preferences/deferred-workstreams`); a blind AI may still believe component tests are banned.
- **C28** No render-harness named (Testing Library? happy-dom?); no example file.
- **C27** "Component contract" mentioned without prop-shape enumeration.
## Severity
High. Without naming the harness + the ban-lift date, AI will refuse to write these tests.
## Fix order
1. Add `Status: enabled since 2026-05-25` line + memory link.
2. Name render harness + example file.
3. Metadata header.
