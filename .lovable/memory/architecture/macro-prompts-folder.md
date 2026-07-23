---
name: macro-prompts-folder
description: standalone-scripts/macro-prompts/ layout, aggregator wiring, and discovery rules for prompt macros
type: architecture
---

# Macro-Prompts Folder

**Location:** `standalone-scripts/macro-prompts/<macro-slug>/`

## Required files per macro

```
standalone-scripts/macro-prompts/<slug>/
  info.json    # MacroDefinition: Slug, Title, Variables[], Steps[], TargetScore, MaxLoops
  body.md      # Human-readable description shown in MacroBuilder
  steps.json   # Ordered Step[] (may be inlined into info.json for simple macros)
```

## Aggregator

`standalone-scripts/build-macro-prompts.mjs` runs at prebuild:

1. Globs `standalone-scripts/macro-prompts/*/info.json`.
2. Validates each against `schemas/macro-definition.schema.json` (fail-fast).
3. Emits `src/generated/macro-prompts.ts` exporting `MACRO_PROMPTS: Record<string, MacroDefinition>`.
4. Writes `public/macro-prompts.manifest.json` (Slug → Title → VarCount) for the Prompts panel.

## Discovery rules

- Slug = folder name; must match `info.json.Slug` exactly (CI guard).
- Reserved slug prefix `System.*` (e.g. `System.SpecTighten`) — ships with extension; user-defined slugs MUST NOT start with `System.`.
- Duplicate slugs → build fails with `Reason='DuplicateMacroSlug'`.

## Why a folder per macro

- Variables[], Steps[], and body.md evolve independently — splitting avoids merge conflicts.
- Allows fixtures (`__tests__/<slug>.spec.ts`) to live next to the macro definition.
- Mirrors `standalone-scripts/prompts/` convention already used by single-shot prompts.

## Cross-references

- Engine: `spec/21-app/05-prompts/macros/engine/00-architecture.md`
- Schemas: `spec/21-app/05-prompts/macros/json/00-overview.md`
- Authoring guide: `spec/21-app/05-prompts/macros/examples/04-macro-prompt-authoring.md`
