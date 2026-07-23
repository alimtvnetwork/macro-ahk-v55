# Versioning & Migration

## SchemaVersion semantics
- Every persisted/exported payload carries `SchemaVersion: <integer>`.
- Current: `SchemaVersion = 1`.
- Bumped on **breaking** shape changes only (add/remove required field, type change, renamed key). Additive optional fields do NOT bump.

## Compatibility matrix
| Reader version | Bundle version | Behavior |
|----------------|----------------|----------|
| N | N | accept directly |
| N | < N | run migrators sequentially v→v+1 until N |
| N | > N | reject with `Reason=UnsupportedSchemaVersion`; surface "Update the extension to import this bundle" |
| N | missing | reject with `Reason=SchemaInvalid` |

## Migrators registry
- Location: `src/prompts/json/migrators/v<from>-to-v<to>.ts`.
- Each migrator: `(input: BundleV<from>) => BundleV<to>` — pure, deterministic, no I/O.
- Registered in `src/prompts/json/migrators/index.ts` as ordered array.
- Unit-tested with before/after fixtures under `tests/fixtures/migrators/v<n>/`.

## Forward compatibility
- Writers NEVER emit fields the active `SchemaVersion` does not declare.
- Readers MUST reject unknown top-level keys (Ajv `additionalProperties: false`).

## Migration failure
- Any migrator throw → abort entire op, `Reason=MigrationFailed`, `ReasonDetail` = `v<from>→v<to>: <message>`.
- Migrators run inside the same SQLite transaction as the consuming op (Import / Replace); rollback on failure.

## Changelog
- Every `SchemaVersion` bump appends an entry to `spec/21-app/05-prompts/macros/changelog.md`.
