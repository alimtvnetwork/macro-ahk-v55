# Drag-drop Import

## Drop zone
- The Prompts panel root acts as the drop target while open.
- Visual affordance: dashed 2px accent border + dimmed overlay ("Drop JSON to import") while `dragenter` is active and payload includes `Files` or `text/plain` of valid JSON shape.
- ESC during drag cancels the visual state.

## Accepted payloads
| Source | Detection |
|--------|-----------|
| File(s) | `event.dataTransfer.files` with `type === 'application/json'` or `.json` extension |
| Text | `event.dataTransfer.getData('text/plain')` that parses as JSON and matches any registered schema |

- Multiple files: process sequentially; one Import-merge dialog per file (no batching — keeps conflict resolution explicit).
- Non-JSON files (`.zip`, `.txt`, images) → toast "Only `.json` files are accepted" + `Reason=UnsupportedDropType`.

## Flow
1. Read file via `FileReader.readAsText` (UTF-8).
2. Parse → Ajv-validate → route to Import-merge (`03-import-merge.md`) **OR** single-item merge if payload is not a bundle.
3. All standard guards apply (running-macro lock, post-state validation, backup ring for Replace).

## Safety
- Hard cap 25 MB per file (`Reason=BundleTooLarge`).
- `dragover` listeners installed only while panel is mounted; removed on unmount + `pagehide` (per timer-and-observer-teardown standard).
- Drop is **never** Replace — drag-drop always merges. Replace stays behind its type-to-confirm dialog.

## Failure log
`Reason ∈ { UnsupportedDropType, BundleTooLarge, ParseFailed, SchemaInvalid }` with `ReasonDetail` = filename + size.
