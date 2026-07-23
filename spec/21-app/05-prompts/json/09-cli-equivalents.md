# CLI Equivalents
Headless equivalents of the panel ops, for CI and bulk authoring. All scripts live under `scripts/` and are invoked via `node scripts/<name>.mjs`.
## `scripts/prompts-export.mjs`
- **Args**: `--out <path>` (required), `--include <prompts|macros|macro-prompts|categories|favorites>` (repeatable; default = all), `--no-redact` (CI only).
- **Reads**: Source-of-truth folders under `standalone-scripts/macro-prompts/`, `standalone-scripts/macros/`, `standalone-scripts/prompts/`.
- **Writes**: Single bundle file matching `schemas/prompts-bundle.schema.json`.
- **Exit**: `0` on success; non-zero with `Reason` code on stderr.
## `scripts/prompts-import.mjs`
- **Args**: `--in <path>` (required), `--mode <merge|replace>` (default `merge`), `--on-conflict <keep|theirs|rename>` (default `keep`), `--dry-run`.
- **Behavior**: Mirrors panel Import / Replace exactly, including backup ring write on `--mode replace`.
- **Output**: JSON summary to stdout: `{ New, Overwritten, Renamed, Skipped, BackupId? }`.
## `scripts/prompts-validate.mjs`
- **Args**: `<file…>` (one or more `.json` files or glob).
- **Behavior**: Ajv-validates each file against the matching schema (auto-detected from `Kind` or bundle shape).
- **Output**: Per-file `OK` / `FAIL` with full Ajv error list on FAIL.
- **Exit**: `0` only if every file passes.
## Shared contract
- All three scripts:
  - Use the **same** validators, migrators, and canonicalizer as the panel (imported from `src/prompts/json/`).
  - Emit failure logs in the mandatory shape (`Reason`, `ReasonDetail`, `VariableContext[]`, `SelectorAttempts[]` where applicable) to stderr.
  - Honor `--quiet` (errors only) and `--json` (machine-readable output) flags.
  - the user's local timezone timezone for any embedded timestamps.
## CI wiring
- `prompts-validate.mjs 'standalone-scripts/**/*.json'` runs in `.github/workflows/ci.yml` on every push (no path filter — per Core rule).
- Failure blocks merge.
