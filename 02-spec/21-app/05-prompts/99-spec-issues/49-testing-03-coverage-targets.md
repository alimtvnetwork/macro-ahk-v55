# Audit — testing/03-coverage-targets.md
**Audited:** 2026-06-02  · 33 lines
## Findings
- **C1** Missing metadata header.
- **C7 Magic numbers** — coverage thresholds named but the per-tier breakdown (unit/component/e2e) lacks concrete percentages.
- **C28** No coverage tool named (c8? istanbul? vitest --coverage?); no output path.
- **C8** No CI gate reference (`.github/workflows/ci.yml`).
- **C13** Overlap with `engine/` quality bars without `Supersedes:`.
## Severity
Medium-High. Targets without enforcement = aspirational only.
## Fix order
1. Set explicit `unit≥X% / component≥Y% / e2e≥Z%`.
2. Name coverage tool + CI gate.
3. Metadata header.
