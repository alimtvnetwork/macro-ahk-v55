# Audit — observability/01-metrics.md
**Audited:** 2026-06-02  · 51 lines
## Findings
- **C1** Missing metadata header.
- **C15 Bare fence (1).**
- **C7** Snake_case metric names are on-policy (Prometheus); doc must explicitly state the exception or C7 flags it as a bug.
- **C28** No exporter/transport named (push? scrape? `chrome.storage`?).
- **C27** Cardinality budget not declared (label-set explosion risk).
- **C8** No link to `mem://features/macro-controller/credit-totals-exclude-free` (similar telemetry doc).
## Severity
High. Metric names without exporter = unimplementable.
## Fix order
1. Add "Prometheus-naming-exception" callout.
2. Declare exporter + cardinality budget per metric.
3. Metadata header.
