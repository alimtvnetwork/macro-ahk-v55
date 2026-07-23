# Save (single prompt or macro)
## Trigger
- Row context menu → **Save** (or `Ctrl+S` while row focused).
- Builder header → **Save** button (saves currently-edited item).
## Flow
1. Serialize the row to canonical JSON (key order below).
2. Validate against `schemas/prompt.schema.json` or `schemas/macro.schema.json` (Ajv strict).
3. On success:
   - Trigger `<a download>` with `application/json` blob, filename `<Kind>.<Slug>.v<Version>.json`.
   - Write same string to clipboard via `navigator.clipboard.writeText`.
   - Toast: "Saved <Slug>.v<Version> (downloaded + copied)".
4. On failure: open Validation Error dialog (see `05-validation-and-errors.md`).
## Canonical payload (prompt)
```json
{
  "SchemaVersion": 1,
  "Kind": "prompt",
  "Slug": "spec-tighten-cycle",
  "Version": 3,
  "Title": "Spec Tighten Cycle",
  "Category": "spec",
  "Tags": ["audit", "spec"],
  "Variables": [ /* shared schema */ ],
  "Body": "…",
  "CreatedAtKL": "2026-06-02T02:15:00.000Z",
  "UpdatedAtKL": "2026-06-02T02:15:00.000Z",
  "Checksum": "sha256:…"
}
```
## Canonical payload (macro)
Same as above but `Kind: "macro"` and adds `Steps[]`, `MaxLoops`, `TargetScore`, `LoopIf` per `schemas/macro.schema.json`.
## Determinism
- Sort `Tags[]` ASCII-ascending before serialize.
- Sort `Variables[]` by `Name` ASCII-ascending.
- `Steps[]` preserves authored order (do NOT sort).
- `Checksum` = sha256 of canonicalized JSON with `Checksum` field set to empty string.
## Failure log
On serialize/validate failure log `Reason ∈ { SchemaInvalid, SerializeFailed, ClipboardDenied, DownloadBlocked }` with `ReasonDetail` (Ajv error path) and `VariableContext[]` listing every Variable involved.
