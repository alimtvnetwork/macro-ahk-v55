# Clipboard Format

## Contract
Single-item **Copy** (row menu → Copy JSON, or `Ctrl+C` on focused row) writes the **exact** same canonical JSON string as Save — byte-for-byte identical.

## Round-trip
1. Copy from row A → clipboard contains canonical single-item JSON.
2. Paste into the Import dialog (or drag-drop a `.json` containing same text) → merges via the standard Import-merge flow (`03-import-merge.md`).
3. Re-Save the imported item → resulting file's `Checksum` matches the original.

## Rules
- Always `application/json` MIME via `ClipboardItem` when the API allows; fall back to `writeText` with the same string.
- No trailing whitespace, no BOM, LF line endings, trailing newline.
- `Checksum` is recomputed on Save, never trusted from clipboard input (Import recomputes and compares).

## Multi-select copy
- Selecting N rows → copy emits a **bundle** payload (`prompts-bundle.schema.json`) with only those items + their referenced categories.
- File-equivalent name suggestion (if user pastes into a file): `prompts-selection-<N>-items.json`.

## Failure
- `Reason=ClipboardDenied` when the browser blocks (e.g., insecure context or permission). UI offers **Download instead** fallback button.
