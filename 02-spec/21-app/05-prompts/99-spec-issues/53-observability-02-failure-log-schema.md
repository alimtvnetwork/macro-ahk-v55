# Audit — observability/02-failure-log-schema.md
**Audited:** 2026-06-02  · 78 lines (largest in folder)
## Findings
- **C1** Missing metadata header.
- **C15 Bare fence (1).**
- **C8** Must `Mirrors: mem://standards/verbose-logging-and-failure-diagnostics` (Core memory owns the canonical shape); currently restated, drift hazard.
- **C27** `Reason` codes mentioned without authoritative enum (Core mem cites `JsThrew`, `SelectorMiss`, etc. — should be inlined or linked).
- **C13** Duplicates `engine/06-message-contract.md` failure-log section.
- **C28** No JSON-Schema artifact path.
## Severity
**Critical.** This is the single most-referenced schema in the subsystem; drift breaks every consumer (UI panel, ZIP export, webhooks).
## Fix order
1. `Mirrors:` Core memory.
2. Inline full `Reason` enum.
3. Publish JSON-Schema at known path.
4. Metadata header.
