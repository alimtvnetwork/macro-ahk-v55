# SS-02: ZIP writer choice and layout

Parent: 12-prompts-import-export-menu
Slug: zip-writer
Status: pending
Created: 2026-07-17

## Goal

Ship a ZIP export that a human can unzip and read without the extension.

## Do

1. Evaluate `fflate` (tiny, browser-safe, no worker required) vs a custom
   store-only writer. If a custom writer covers our needs in under ~150
   lines, prefer it (no new dep).
2. Layout:
   - `/manifest.json` — envelope from `buildPromptsBundle()` minus bodies.
   - `/entries/<slug>.md` — the Markdown body.
   - `/entries/<slug>.html` — the HTML body if `bodyHtml` is present.
   - `/entries/<slug>.meta.json` — the entry's metadata block.
3. Filenames sanitized per parent step 21.
4. ZIP importer reads `/manifest.json` first, then walks `/entries/*.meta.json`
   and pairs to bodies by slug.

## Done when

- Round-trip test in parent step 25 passes for the ZIP format.
- Manual `unzip` on macOS/Linux produces the layout above.
