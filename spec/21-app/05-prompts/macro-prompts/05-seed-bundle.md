# Macro-Prompts — Seed Bundle
**Created:** 2026-06-02
Macro-prompts ship inside the extension just like human prompts: the bundled JSON is read at install/update time and seeded into SQLite via the existing `LoadBundledDefaultPrompts` flow (`mem://features/prompt-management`).
## Bundle origin
`chrome-extension/macro-prompts/macro-prompts.json` (produced by `aggregate-prompts.mjs`, see `03-aggregation-pipeline.md`).
## Seeding lifecycle (sequential, fail-fast — `mem://constraints/no-retry-policy`)
1. **Install or update event** fires (`chrome.runtime.onInstalled`).
2. Loader reads `macro-prompts.json` from the extension package (no network).
3. Validates wrapper against `schemas/prompts-bundle.schema.json`.
4. Computes the local `BuildHash` and compares to the persisted `MacroPrompts.LastSeededBuildHash` in `chrome.storage.local`.
5. **If hash matches** → noop. Seeding is idempotent.
6. **If hash differs (or key missing)** → run the seed:
   - For each `Prompts[]` entry: upsert into SQLite `MacroPrompts` table keyed by `Slug`.
   - Identity-only writes — never rewrite existing user-modified bodies; user copies live in a sibling `MacroPromptsUserOverride` table (matches the established pattern for `Prompts`).
7. After successful seed, write the new `BuildHash` to `MacroPrompts.LastSeededBuildHash`.
## Storage contract
Per `mem://constraints/no-storage-pascalcase-migration` — keys are identity-only. No rewrites of existing storage shapes.
- `chrome.storage.local`:
  - `MacroPrompts.LastSeededBuildHash` — string.
  - `MacroPrompts.SeededAt` — ISO-8601 the user's local timezone timestamp.
- SQLite:
  - Table `MacroPrompts` (PascalCase columns): `Slug PRIMARY KEY, Title, Description, Category, Version, VariablesJson, BodyMd, WritesToJson, EmitsScore, IsFavorite, IsExperimental, UpdatedAt`.
  - Table `MacroPromptsUserOverride`: same shape, populated only when a user edits a seeded prompt.
## Failure handling
Any seeding failure raises a `BootFailureBanner` (`mem://architecture/extension-error-management`) with the mandatory failure-log shape:
```
Reason         : MacroPromptsSeedFailed
ReasonDetail   : <ajv error | sqlite error | io error>
VariableContext: [{ name: "BundlePath", source: "Extension", resolvedValue: "macro-prompts/macro-prompts.json", type: "path", reason: "<read|parse|validate|write>" }]
```
No retry, no exponential backoff. The user can trigger a manual reseed from the Options → Diagnostics panel; failure is surfaced, not silently swallowed (`mem://standards/error-logging-via-namespace-logger`).
## Reseed triggers (in addition to install/update)
- Manual: Options → Diagnostics → "Reseed macro-prompts".
- Self-heal: if `LoadBundledDefaultPrompts` boot check detects `MacroPrompts` table is empty but `LastSeededBuildHash` is present (corruption / wipe), the loader clears the hash and reseeds. Mirrors `mem://architecture/self-healing-script-storage` two-stage pattern.
