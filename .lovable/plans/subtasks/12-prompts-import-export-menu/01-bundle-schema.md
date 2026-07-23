# SS-01: Bundle schema audit and extension

Parent: 12-prompts-import-export-menu
Slug: bundle-schema
Status: pending
Created: 2026-07-17

## Goal

Guarantee `schemas/prompts-bundle.schema.json` covers every runtime field on
a prompt entry so JSON, ZIP, and SQLite exports carry the same shape and
importers can validate uniformly.

## Do

1. Diff the runtime `PromptEntry` type in `prompt-manager.ts` against the
   schema. List missing keys (candidates: `replaceKey`, `mirrorPath`,
   `excludeFromExport`, `updatedAt`, `category`, `tags[]`).
2. Extend the schema with the missing keys, all optional except `slug`,
   `name`, and one of `bodyMarkdown` / `bodyHtml`.
3. Add a top-level envelope block: `schemaVersion` (const 1), `exportedAt`
   (ISO), `exporterVersion` (semver), `entryCount` (int), `entries[]`.
4. Add example fixtures under `standalone-scripts/macro-controller/tests/fixtures/prompts-bundle/`.
5. Write a vitest that loads each fixture and validates against the schema
   using the existing ajv setup.

## Done when

- Schema validates a real export produced by step 6 of the parent plan.
- All fixture tests pass.
