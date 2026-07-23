---
Slug: diagnostics-export
Status: pending
Created: 2026-07-19
Parent: 26-professional-diagnostic-errors-20-step
---

# SS-04 Diagnostics export update

Extend the log-diagnostics ZIP exporter to emit:

- `error-code-index.json`: `{ [code]: { count, firstSeen, lastSeen, lastContext } }`.
- `errors.md`: human report grouped by area then severity, each entry shows code, humanTemplate rendered with lastContext, and file:line of the throw site (from registry metadata).
- Redact sensitive keys per verbose-logging rules before writing.

Consumers: user "Copy diagnostics" flow, CI failure attachments, support triage.
