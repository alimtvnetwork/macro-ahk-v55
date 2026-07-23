# Prompts bundle test fixtures

Round-trip and schema fixtures for plan 12 (steps 23-25). Every file here is
loaded verbatim by the Vitest suites; do not edit shape without updating the
corresponding assertions.

## Valid

- `valid-minimal.json` — smallest legal bundle. One entry with only `name` +
  `text`. Covers the "brand new user, single prompt export" path.
- `valid-full.json` — every optional envelope + entry field populated,
  including a dynamic-expansion entry (`slugTemplate`, `parentSlug`,
  `variantValue`, `replaceValues`). Locks the round-trip guarantee for the
  `Next ${N}` / `Plan ${N}` prompts identified in
  `.lovable/plans/subtasks/12-prompts-import-export-menu/notes-01-call-graph.md`.

## Invalid

Each file targets exactly one envelope invariant so a failure message is
unambiguous.

- `invalid-bad-uuid.json` — `id` is not a UUIDv4.
- `invalid-schema-version.json` — `schemaVersion: 2` (future-proofing for
  step 29's CI gate).
- `runtime-invalid-count-mismatch.json` — `entryCount` disagrees with
  `entries.length`.
- `invalid-entry-missing-name.json` — one entry lacks the required `name`.
- `invalid-entries-not-array.json` — `entries` is a string, not an array.
