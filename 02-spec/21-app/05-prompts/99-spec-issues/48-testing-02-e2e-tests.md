# Audit — testing/02-e2e-tests.md
**Audited:** 2026-06-02  · 33 lines
## Findings
- **C1** Missing metadata header.
- **C8** No link to the manual-Chrome E2E ban-lift (`mem://preferences/deferred-workstreams`, 2026-05-25); same hazard as C47.
- **C28** Runner not named (Playwright? Puppeteer? manual?); no profile/path.
- **C7** "Headless" vs "headed" decision not declared.
- **C26** Overlaps `deployment-diagnostics` memory without `Mirrors:`.
## Severity
High. E2E spec without a runner is a guess.
## Fix order
1. Declare runner + invocation command.
2. Add ban-lift line + memory link.
3. Define headless default.
