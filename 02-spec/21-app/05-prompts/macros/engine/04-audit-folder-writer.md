# Audit Folder Writer

## Root path
```
spec/audit/<RunId>/
```
`RunId` = `crypto.randomUUID()` (lowercase, no braces). Never reused.

## File layout

| File | Content | Written when |
|------|---------|--------------|
| `_meta.json` | `{ RunId, MacroSlug, MacroVersion, StartedAtKL, FinishedAtKL?, FinalState, FinalScore?, LoopsConsumed }` | on Start (partial); patched on each transition |
| `_log.jsonl` | newline-delimited `MacroEvent` stream | append-only per event |
| `step-<NN>-<Kind>-input.md` | resolved prompt body sent to the model | before ExecStep dispatched |
| `step-<NN>-<Kind>-output.md` | raw model output | on StepCompleted |
| `step-<NN>-<Kind>-failure.json` | mandatory failure shape | on StepFailed only |
| `variables-snapshot.json` | resolved Variables (Sensitive masked) | on Start, again on each Loop entry |

`NN` = zero-padded StepIndex (`01`, `02`, …). `Kind` = step kind slug (`prompt`, `js-inline`, `recorder`, …).

## Idempotency
- Writer uses `O_EXCL`-equivalent semantics (refuse to overwrite). Collision → `Reason='AuditCollision'`, `ReasonDetail` = full path.
- `_log.jsonl` is the only append target; all other files are write-once.
- Re-runs **never** target an existing `RunId` folder.

## Collision handling
- If `spec/audit/<RunId>/` somehow exists (UUID collision is astronomically unlikely but defended): regenerate `RunId`, retry **once**, then fail-fast (no exponential backoff — per No-Retry policy).

## Forbidden destinations
- Never write under `skipped/`, `.release/`, `node_modules/`, `dist/`, or any path resolved outside `spec/audit/`.
- Path traversal guard: reject any computed path where `path.relative('spec/audit', target).startsWith('..')`.

## Cleanup
- No auto-cleanup. Audit folders are kept until the user clears them (consistent with extension diagnostics).
- Diagnostics export bundles include the entire `spec/audit/<RunId>/` tree (see `observability/03-export-bundle.md`).

## Failure log
`Reason ∈ { AuditCollision, PathOutsideRoot, WriteDenied, EncodeFailed }` with `ReasonDetail` = absolute path + step index.
