# Export All
## Trigger
- Panel ⋯ menu → **Export All**.
## Output
Single file `prompts-bundle-YYYYMMDD-HHmm-local time.json` validated against `schemas/prompts-bundle.schema.json`.
## Canonical bundle shape
```json
{
  "SchemaVersion": 1,
  "ExportedAtKL": "2026-06-02T02:30:00.000Z",
  "ExtensionVersion": "3.41.0",
  "Categories":  [ /* PromptCategories rows, sorted by Slug */ ],
  "MacroPrompts":[ /* sorted by Slug */ ],
  "Prompts":     [ /* sorted by Slug */ ],
  "Macros":      [ /* sorted by Slug */ ],
  "Favorites":   [ /* { Source, Slug } sorted by Source, Slug */ ],
  "Checksum":    "sha256:…"
}
```
## Ordering rules
- Top-level keys: fixed order above.
- Each list: sort ASCII-ascending by `Slug` (Favorites by `Source` then `Slug`).
- Within each item: same canonical key order as Save (see `01-save-single.md`).
## Redaction
- Strip `Variables[].DefaultValue` when `Sensitive: true` (replace with `"***REDACTED***"`).
- Strip per-user run history, last-used timestamps, and any auth tokens. Bundle is shareable artifact only.
- Never include `chrome.storage.local` runtime keys (e.g., `PromptsBackupRing`, run state).
## Size guard
- Warn if bundle > 5 MB (toast + confirm). Hard fail at 25 MB with `Reason=BundleTooLarge`.
## Failure log
`Reason ∈ { SchemaInvalid, RedactionFailed, BundleTooLarge, DownloadBlocked }` with `ReasonDetail` and counts per list.
