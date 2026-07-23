# Validation & Errors
## Validator
- Ajv strict-mode singleton, compiled once at panel mount.
- Schemas registered: `prompt`, `macro`, `macro-prompt`, `variable`, `prompts-bundle`.
- All schemas use `additionalProperties: false`; unknown keys are hard errors.
## Error surface
For every failure (Save / Export / Import / Replace / Clipboard / Drag-drop):
1. Inline toast: short `Reason` code (e.g., "SchemaInvalid").
2. Expandable **Show details** dialog with:
   - `Reason`, `ReasonDetail`, `Operation`, `RunId`, `Timestamp` .
   - Ajv error table: `instancePath`, `keyword`, `message`, `params`.
   - **Copy diagnostic JSON** button.
3. Persisted to `spec/audit/<runId>/_log.jsonl` via `RiseupAsiaMacroExt.Logger.error()`.
## Mandatory failure-log shape
```json
{
  "Reason": "SchemaInvalid",
  "ReasonDetail": "/Steps/2/LoopIf must be string",
  "Operation": "Import",
  "RunId": "…",
  "VariableContext": [ /* every Variable involved; null + reason if unknown */ ],
  "SelectorAttempts": [ /* for slug-collision / lookup failures */ ],
  "AjvErrors": [ /* raw Ajv error array */ ]
}
```
## Reason codes (canonical)
`ParseFailed`, `SchemaInvalid`, `SerializeFailed`, `ChecksumMismatch`, `ClipboardDenied`, `DownloadBlocked`, `BundleTooLarge`, `BackupFailed`, `BackupQuotaExceeded`, `TransactionRolledBack`, `PostStateMismatch`, `ConfirmCancelled`, `ConflictUnresolved`, `RedactionFailed`, `MigrationFailed`, `UnsupportedSchemaVersion`.
## No-swallow rule
Every catch path MUST call `Logger.error()` AND surface via UI. No empty catches, no `console.warn`-only paths.
