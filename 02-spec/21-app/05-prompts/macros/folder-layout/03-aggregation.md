# Macros — Aggregation
**Created:** 2026-06-02
Extends `scripts/aggregate-prompts.mjs` with a third pass that turns `standalone-scripts/macros/*.macro.json` into a single bundle.
## Inputs
```
standalone-scripts/macros/<NNN>-<slug>.macro.json
```
## Output
```
chrome-extension/macros/macros.json
```
Wrapper conforms to `schemas/prompts-bundle.schema.json` with `Source: "macros"`.
## Pipeline stages (sequential, fail-fast — `mem://constraints/no-retry-policy`)
1. **Discover** — `readdir` `standalone-scripts/macros/`, filter to `*.macro.json`. Skip dotfiles.
2. **Validate filename** — apply regex from `01-naming.md`. Failure → specific `Reason` code (`NumberingNotZeroPadded`, `SlugInvalidCharacters`, `MacroSuffixMissing`, …).
3. **Read & parse** — `JSON.parse`. Size ≤ 256 KB per file.
4. **Schema-validate** — Ajv against `schemas/macro.schema.json` (strict, `additionalProperties:false`). Discriminated `Steps[]` `oneOf` ensures every step shape is exact.
5. **Internal consistency** — assert `Slug` field equals filename slug segment (`Reason="SlugFilenameMismatch"`).
6. **Cross-reference resolution** — for every `Step` with a `Slug` (`prompt`, `audit`, `fix-from-audit`, `final-audit`), confirm the prompt exists in either the in-memory `macro-prompts/` set (preferred) or `prompts/` set. Missing → `Reason="UnknownPromptSlug"` with `VariableContext[]` showing macro slug + step index.
7. **Variable closure check** — every `{{ Placeholder }}` in any step's `Variables` map MUST be declared on the referenced prompt OR be a built-in run-context variable (`variables/05-built-in-context.md`). Missing → `Reason="UndeclaredPlaceholder"`.
8. **Loop-if sanity** — `GotoStep` must be a valid 0-based index strictly less than the step's own index. Forward jumps and self-loops → `Reason="InvalidLoopTarget"`.
9. **Duplicate detection** — within `macros/` only. Collision → `Reason="DuplicateMacroSlug"`.
10. **Sort** — by numeric prefix ascending, then `Slug`.
11. **Hash** — same `Count-Hash36` format as prompts bundles (`macro-prompts/06-versioning.md`).
12. **Emit** — atomic write to `chrome-extension/macros/macros.json` (`*.tmp` + rename). Bundle keys: `Version`, `BuildHash`, `GeneratedAt` , `Source: "macros"`, `Count`, `Macros[]`.
13. **Manifest sync** — record `BuildHash` in the build manifest consumed by the install/update seeder.
## Ordering relative to prompts pipeline
The aggregator runs all three passes in this fixed order (one process, sequential):
```
1. prompts/         → chrome-extension/prompts/prompts.json
2. macro-prompts/   → chrome-extension/macro-prompts/macro-prompts.json
3. macros/          → chrome-extension/macros/macros.json
```
Stage 6 of the macros pass requires the slug sets from passes 1 + 2 (held in memory). Reordering breaks cross-reference validation.
## CI hook (extends `scripts/prebuild-clean-and-verify.mjs`)
One additional assertion:
- `chrome-extension/macros/macros.json` exists, parses, hash recomputes identically.
- Every `Macros[].Steps[].Slug` (where present) resolves against the corresponding prompts bundles in the same dist.
Build lock honoured (`mem://features/build-lock-sentinel`). No CI notifications (`mem://constraints/no-ci-notifications`).
## Failure log shape (mandatory)
Per repo standard (`mem://standards/verbose-logging-and-failure-diagnostics`):
```
Reason          : <code from above>
ReasonDetail    : <human description>
Path            : <absolute file path>
SelectorAttempts: null   // n/a for build-time
VariableContext : [{ name: "MacroSlug", source: "Filename", resolvedValue: "spec-tighten-cycle", type: "string", reason: "ok|mismatch|missing" }, … ]
```
## Test coverage (`mem://preferences/test-with-features`)
`scripts/__tests__/aggregate-macros.test.mjs`:
- Valid 3-macro fixture → bundle round-trips, hash deterministic across two runs.
- Invalid fixtures cover each documented `Reason` (one fixture per code, 8 cases minimum).
- Cross-reference: macro referencing an unknown prompt slug → `UnknownPromptSlug` with both paths logged.
- Loop-if forward jump → `InvalidLoopTarget`.
