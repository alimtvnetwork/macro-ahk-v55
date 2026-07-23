# Macro-Prompts — Resolution Order
**Created:** 2026-06-02
The macro engine and the Prompts panel both resolve a `Slug` to a prompt definition. Resolution is **deterministic and fail-fast** — no fuzzy matching, no fallbacks beyond the documented order.
## Lookup order
1. **`macro-prompts/macro-prompts.json`** (NEW bundle) — searched first.
2. **`prompts/prompts.json`** (existing bundle) — searched second.
3. **Not found** → raise `Reason="UnknownPromptSlug"` with `ReasonDetail` listing the slug and both bundle paths consulted.
The first match wins. The resolver short-circuits and never consults the second bundle once the first hits.
## Why macro-prompts first
Macro-prompts are the higher-fidelity, variable-aware variant. If a human-facing prompt and a macro-prompt ever share a slug by accident, build aborts (see "Duplicate detection" below) — but the runtime ordering guarantees that during the brief window between author intent and build, macro-prompts still take precedence.
## Duplicate detection (build time)
The aggregator (`03-aggregation-pipeline.md`, stage 6) computes the union of all slugs across both folders. Any collision aborts the build:
```
Reason         : DuplicateSlug
ReasonDetail   : Slug "audit-spec" defined in both folders
Paths          : standalone-scripts/prompts/042-audit-spec/info.json
                 standalone-scripts/macro-prompts/001-audit-spec/info.json
```
No autorename, no last-write-wins. Author must rename one.
## Runtime resolver contract (pseudo-code)
```ts
function resolvePrompt(slug: string): PromptDefinition {
  const fromMacro = MacroPromptsBundle.bySlug.get(slug);
  if (fromMacro) { return fromMacro; }
  const fromHuman = PromptsBundle.bySlug.get(slug);
  if (fromHuman) { return fromHuman; }
  throw makeFailure({
    Reason: "UnknownPromptSlug",
    ReasonDetail: `Slug "${slug}" not in macro-prompts.json or prompts.json`,
    VariableContext: [{ name: "Slug", source: "MacroStep", resolvedValue: slug, type: "string", reason: "not-found" }],
  });
}
```
Both `bySlug` maps are built once at bundle-load and frozen — see `mem://features/prompt-management` (dual-cache).
## Verbose-logging interaction
When `Project.VerboseLogging === true`, the resolver additionally logs the consulted bundle `BuildHash` values and the total slug counts. Otherwise these are omitted (`mem://standards/verbose-logging-and-failure-diagnostics`).
