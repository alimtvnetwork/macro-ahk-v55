# Macro-Prompts — Versioning
**Created:** 2026-06-02
Two distinct version axes apply to macro-prompts. Do not conflate them.
## 1. Per-prompt `Version` (in `info.json`)
- SemVer string (`MAJOR.MINOR.PATCH`).
- **Bump rules:**
  - PATCH — typo, whitespace, copy tweak that does not change semantic output.
  - MINOR — body change, added optional variable (with `Default`), added optional `WritesTo` glob.
  - MAJOR — removed/renamed variable, added Required variable without Default, slug rename (also rename folder), `EmitsScore` flipped.
- A MAJOR bump that affects existing macro references is a breaking change — update referencing macros in the same commit.
- The aggregator records each prompt's `Version` verbatim in the bundle.
## 2. Bundle `BuildHash` (in `macro-prompts.json`)
Format:
```
BuildHash = <Count zero-padded to 5>-<Hash36>
Count   : decimal number of prompts in this bundle, zero-padded to 5 digits
Hash36  : first 6 characters (uppercase) of the base-36 encoding of
          SHA-256 over the canonical JSON serialization of `Prompts[]`
          (sorted by Slug ascending, keys sorted alphabetically, no whitespace)
```
Example: `00042-3F7K1Z` — 42 prompts, content hash `3F7K1Z`.
This matches the established convention for the existing `prompts.json` so tooling stays uniform (`mem://workflow/versioning-policy`).
## Reseed trigger rules
The loader reseeds bundled defaults when **any** of these is true:
1. `MacroPrompts.LastSeededBuildHash` is absent in `chrome.storage.local`.
2. Persisted `LastSeededBuildHash` differs from the bundle's `BuildHash`.
3. Manifest version (extension version) changed since last seed AND at least one prompt's `Version` MAJOR changed (the aggregator emits a sidecar `MajorBumpedSlugs[]` for cheap detection).
4. Self-heal path: SQLite `MacroPrompts` table is empty (corruption / migration wipe) — see `05-seed-bundle.md`.
Conditions 1–3 are evaluated by string compare only. No retry, no backoff (`mem://constraints/no-retry-policy`).
## Hash determinism (mandatory test coverage)
`scripts/__tests__/macro-prompts-build-hash.test.mjs` asserts:
- Same input directory → identical `BuildHash` across two consecutive builds.
- Reordering files on disk does not change `BuildHash` (sort is by `Slug`).
- Changing a single character in any `prompt.md` or `info.json` changes `BuildHash`.
## Cross-bundle invariant
Macro-prompts and human-prompts use the **same** hash format but emit **independent** `BuildHash` values. They never share a hash namespace. The extension stores them separately:
- `Prompts.LastSeededBuildHash` (existing)
- `MacroPrompts.LastSeededBuildHash` (NEW)
Identity-only — neither key is rewritten or renamed (`mem://constraints/no-storage-pascalcase-migration`).
