# Macros — Schema Reference
**Created:** 2026-06-02
Four JSON Schemas (Draft-07, strict, PascalCase keys) define every on-disk and bundle artefact for prompts, macro-prompts, and macros.
## Schema map
| Schema                                         | Purpose                                                                                  | Used by                                                                          |
|------------------------------------------------|------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| `schemas/variable.schema.json`                 | Single variable declaration (shared)                                                     | `prompt.schema.json` (`Variables[]`), `macro.schema.json` (`Variables[]`, `VariableValues`) |
| `schemas/prompt.schema.json`                   | One prompt's `info.json` (folder-level shape, no `Body`)                                 | `standalone-scripts/prompts/<NNN-slug>/info.json`, `standalone-scripts/macro-prompts/<NNN-slug>/info.json` |
| `schemas/macro.schema.json`                    | One `.macro.json` file (Steps[] discriminated union by Kind)                             | `standalone-scripts/macros/<NNN-slug>.macro.json`                                |
| `schemas/prompts-bundle.schema.json`           | Build-time bundle wrapper (`Version`, `BuildHash`, `GeneratedAt`, `Source`, `Count`, `Prompts[]` or `Macros[]`) | `chrome-extension/prompts/prompts.json`, `chrome-extension/macro-prompts/macro-prompts.json`, `chrome-extension/macros/macros.json` |
## Worked example — minimal prompt
`standalone-scripts/macro-prompts/001-audit-spec/info.json`:
```json
{
  "Slug": "audit-spec",
  "Title": "Audit Spec Folder",
  "Description": "Audits a spec subtree to a given depth and emits a 0–100 score.",
  "Category": "Audit",
  "Version": "1.0.0",
  "EmitsScore": true,
  "WritesTo": ["spec/audit/{{ RunId }}/"],
  "Variables": [
    { "Name": "TargetFolder", "Type": "path",   "Required": true,  "Description": "Subtree to audit." },
    { "Name": "Depth",        "Type": "integer","Required": false, "Default": 3, "Description": "Max walk depth." },
    { "Name": "RunId",        "Type": "string", "Required": true,  "Source": "RunContext", "Description": "Engine-supplied." }
  ]
}
```
Validation:
- `variable.schema.json` `Name` pattern accepts `TargetFolder`, `Depth`, `RunId`.
- `Default: 3` is allowed on `Depth` (`Required:false`).
- `RunId` has no `Default` and `Source:"RunContext"` — `allOf` guard in macro engine forbids `Default` here at runtime.
## Worked example — minimal macro
`standalone-scripts/macros/001-spec-tighten-cycle.macro.json`:
```json
{
  "Slug": "spec-tighten-cycle",
  "Title": "Spec Tighten Cycle",
  "Description": "Audit a spec subtree, fix findings, re-audit, loop until score ≥ TargetScore.",
  "Version": "1.0.0",
  "TargetScore": 90,
  "MaxLoops": 3,
  "Variables": [
    { "Name": "TargetFolder", "Type": "path",    "Required": true,  "Description": "Macro-scoped target." },
    { "Name": "Depth",        "Type": "integer", "Required": false, "Default": 3, "Description": "Audit depth." }
  ],
  "Steps": [
    { "Kind": "audit",          "Slug": "audit-spec",     "Variables": { "TargetFolder": "spec/21-app", "Depth": 4 } },
    { "Kind": "prompt",         "Slug": "gap-analysis" },
    { "Kind": "fix-from-audit" },
    { "Kind": "next-loop",      "Count": 10 },
    { "Kind": "final-audit",    "Slug": "final-score" },
    { "Kind": "prompt",         "Slug": "score-extract" },
    { "Kind": "loop-if",        "GotoStep": 0, "ScoreLessThan": 90 }
  ]
}
```
Validation:
- Each step matches exactly one branch of the `Steps[]` `oneOf`.
- `MaxLoops: 3` satisfies the `1..10` hard cap.
- `loop-if.GotoStep: 0` points back to the `audit` step (0-indexed).
## Worked example — bundle wrapper
`chrome-extension/macros/macros.json`:
```json
{
  "Version": "1.0.0",
  "BuildHash": "00003-9KQ2A7",
  "GeneratedAt": "2026-06-02T02:15:00.000Z",
  "Source": "macros",
  "Count": 3,
  "Macros": [ /* … 3 entries matching macro.schema.json … */ ]
}
```
Validation: `Source == "macros"` triggers the `allOf` branch that requires `Macros[]` (and forbids `Prompts[]`).
## Ajv usage (consumer side)
```js
import Ajv from "ajv";
import variable from "../schemas/variable.schema.json" with { type: "json" };
import prompt   from "../schemas/prompt.schema.json"   with { type: "json" };
import macro    from "../schemas/macro.schema.json"    with { type: "json" };
import bundle   from "../schemas/prompts-bundle.schema.json" with { type: "json" };
const ajv = new Ajv({ strict: true, allErrors: true });
ajv.addSchema(variable);
ajv.addSchema(prompt);
ajv.addSchema(macro);
const validateBundle = ajv.compile(bundle);
```
Strict mode + `additionalProperties:false` on every object — surface typos as `MacroSchemaViolation` immediately. No retries (`mem://constraints/no-retry-policy`).
