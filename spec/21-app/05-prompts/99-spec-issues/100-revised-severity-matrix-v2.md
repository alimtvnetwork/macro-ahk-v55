# 100 — Revised Severity Matrix (v2, post-retraction)
**Date:** 2026-06-02
**Supersedes:** `91-severity-matrix.md`
## Why v2
Files 96–98 retract three Criticals proven false by direct file-system verification. File 99 confirms two genuine Criticals.
## Revised distribution
| Severity | v1 count | v2 count | Δ |
|---|---:|---:|---:|
| Critical | 14 | **2** | −12 |
| High | 17 | ~10 | −7 (most "High" cited phantom files) |
| Medium | 8 | ~12 | +4 (downgrades) |
| Low / Clean | 8 | 8 | 0 |
## Confirmed Criticals (v2)
| # | ID | Source file | Headline |
|---|---|---|---|
| 1 | C66 | `99-CONFIRMED-c66-c67-…` | `mem://features/prompt-macros` file missing |
| 2 | C67 | `99-CONFIRMED-c66-c67-…` | `mem://features/prompt-variables` file missing |
## Retracted Criticals (v2)
C29, C41, C42, C45, C53, C57, C58, C61, C62, C63, C68, C70, C72 → all need per-doc re-verification against the **real** file tree before any severity is re-assigned. Currently provisionally downgraded to Medium pending re-audit.
## Text chart
```
CRITICAL ██ 2
High     ██████████ 10
Medium   ████████████ 12
Low      ████████ 8
```
## Note
Most "High" entries in v1 cited files that DO exist. They should be re-read for actual drift — likely most resolve to Low/Clean.
