# Audit — macros/04-loop-and-score.md
**Audited:** 2026-06-02  · 73 lines
## Findings
- **C1** Missing metadata header.
- **C15 Bare fences (6).**
- **C7 Magic numbers** — `TargetScore=95`, `MaxIters` referenced but neither defaults nor bounds enumerated.
- **C10/C26** Loop semantics duplicate `guards/01-loop-safety.md`; both authoritative-feeling without `Supersedes:`.
- **C8** Must `Mirrors: mem://constraints/no-retry-policy`.
- **C27** Verdict set (`PASS`/`RETRY`/`ABORT`) referenced by `examples/01-review-and-fix-loop.md` but enum not formally declared here.
## Severity
**Critical.** Scoring formula + halt criteria — if blind AI guesses, loops run forever or terminate too early.
## Fix order
1. Declare canonical owner (this doc) for scoring; guard becomes safety overlay.
2. Inline default `TargetScore` + bounds for `MaxIters`.
3. Formally declare verdict enum.
4. `Mirrors:` no-retry memory.
