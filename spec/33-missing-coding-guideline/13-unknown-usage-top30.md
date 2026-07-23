# 13. `unknown`-usage Top-30 Remediation Plan

Signal: `rg ": unknown|<unknown>|as unknown|Record<string, unknown>|unknown\)" -g '*.ts' -g '!**/__tests__/**' -g '!**/*.test.ts'` across `standalone-scripts/`.

Baseline: **693 occurrences** in production code (excluding tests). Rule: `mem://standards/unknown-usage-policy` — `unknown` allowed only in `CaughtError` position; function parameters and public return types must be fully typed.

## Pattern breakdown

| Pattern                        | Count | Legitimate?                                     |
| ------------------------------ | ----- | ----------------------------------------------- |
| `: unknown` (annotation)       | 393   | Only in `catch (e: unknown)` / narrowing helpers |
| `Record<string, unknown>`      | 211   | Only for opaque JSON bags at process boundaries |
| `as unknown` (double cast)     | 95    | **Always suspect** — indicates a missing type    |
| `unknown[]`                    | 21    | Almost always replaceable with a discriminated union |

The 95 `as unknown` casts and the 21 `unknown[]` arrays are the priority: they *hide* type errors rather than defer them.

## Top-30 files (denominator for remediation)

| Rank | File                                                                | Count | Pattern class (primary)               |
| ---- | ------------------------------------------------------------------- | ----- | ------------------------------------- |
| 1    | `standalone-scripts/types/project-namespace-shape.d.ts`             | 28    | `Record<string, unknown>` in .d.ts    |
| 2    | `marco-sdk/src/self-test.ts`                                        | 22    | Runtime probes — legitimate `unknown` |
| 3    | `macro-controller/src/startup.ts`                                   | 21    | `as unknown as` bridge casts          |
| 4    | `macro-controller/src/api-namespace.ts`                             | 20    | Namespace bag typing                  |
| 5    | `marco-sdk/src/self-namespace.ts`                                   | 19    | Namespace assembly                    |
| 6    | `macro-controller/src/config-validator.ts`                          | 16    | Input validation — legitimate         |
| 7    | `macro-controller/src/globals.d.ts`                                 | 15    | Global augmentation .d.ts             |
| 8    | `macro-controller/src/settings-store.ts`                            | 14    | Storage round-trip                    |
| 9    | `macro-controller/src/ws-move.ts`                                   | 13    | API response parsing                  |
| 10   | `macro-controller/src/startup-idempotent-check.ts`                  | 13    | Boot probe                            |
| 11   | `macro-controller/src/credit-fetch.ts`                              | 12    | API response parsing                  |
| 12   | `macro-controller/src/auth-resolve.ts`                              | 12    | Bearer bridge                         |
| 13   | `macro-controller/src/ws-members-mutations.ts`                      | 11    | API mutations                         |
| 14   | `macro-controller/src/ws-members-panel.ts`                          | 10    | API + DOM                             |
| 15   | `macro-controller/src/ui/template-renderer.ts`                      | 10    | Template value coercion               |
| 16   | `macro-controller/src/ui/prompt-bundle-types.ts`                    | 10    | Bundle validation                     |
| 17   | `marco-sdk/src/auth-response.ts`                                    | 9     | API parsing                           |
| 18   | `macro-controller/src/ws-context-menu.ts`                           | 9     | DOM                                   |
| 19   | `macro-controller/src/credit-parser.ts`                             | 9     | API parsing                           |
| 20   | `lovable-owner-switch/src/flow/run-promote.ts`                      | 9     | API                                   |
| 21   | `marco-sdk/src/config.ts`                                           | 8     | Config bag                            |
| 22   | `marco-sdk/src/auth-token-utils.ts`                                 | 8     | Token narrowing                       |
| 23   | `macro-controller/src/ui/prompt-dropdown.ts`                        | 8     | DOM + storage                         |
| 24   | `macro-controller/src/pro-zero/pro-zero-workspace-adapter.ts`       | 8     | API                                   |
| 25   | `macro-controller/src/auth-bridge.ts`                               | 8     | Bearer bridge                         |
| 26   | `macro-controller/src/ws-list-renderer.ts`                          | 7     | API + DOM                             |
| 27   | `macro-controller/src/ui/prompt-loader.ts`                          | 7     | Storage                               |
| 28   | `macro-controller/src/ui/prompt-io-sqlite-reader.ts`                | 7     | SQLite round-trip                     |
| 29   | `macro-controller/src/ui/prompt-injection.ts`                       | 7     | DOM                                   |
| 30   | `macro-controller/src/ui/database-modal-data.ts`                    | 7     | SQLite round-trip                     |

**Top-30 total: 336 of 693 occurrences (48.5 %)** — fixing the top 30 halves the surface.

## Remediation strategy (per class, not per file)

**Class A — API response parsing (files 9, 11, 13, 17, 19, 20, 24, 26)**
Root cause: raw `fetch().then(r => r.json() as unknown as X)`. Fix: introduce a `parse<Schema>()` helper per API in a dedicated `*-schema.ts` file that returns a typed result or throws `ApiParseError`. Reuse Zod-lite style validators already present in `config-validator.ts`. Removes ~80 occurrences.

**Class B — Namespace bags (files 1, 4, 5, 7)**
Root cause: `RiseupAsiaMacroExt.*` global surface declared with `Record<string, unknown>`. Fix: promote the ad-hoc records into named interfaces in `types/project-namespace-shape.d.ts`; every `.ts` consumer imports the interface. Removes ~82 occurrences.

**Class C — `as unknown as` double casts (files 3, 25 + scattered)**
Root cause: 95 sites. Each one is a missing declaration. Fix: for each site, either (i) extend the target type, or (ii) add a runtime type guard. Zero tolerance: after the pass, `no-restricted-syntax` bans `as unknown as` outside `types/**`. Removes ~95 occurrences.

**Class D — Storage round-trip (files 8, 27, 28, 30)**
Root cause: `JSON.parse()` returns `unknown`, and codebase forwards it. Fix: wrap `chrome.storage.local.get` and `localStorage.getItem` in typed accessors keyed by `StorageKey` enum (already partial in `types/storage-keys.ts`, cross-links to audit 08). Removes ~35 occurrences.

**Class E — DOM + template coercion (files 15, 18, 23, 29)**
Root cause: `element.dataset` / `HTMLElement.value` typed as `string | undefined` but downstream expects domain types. Fix: `dataset-typed.ts` helper module with `readDataset<K extends keyof Schema>(el, key): Schema[K]`. Removes ~34 occurrences.

**Class F — Legitimate `unknown`** (files 2, 6): keep. `self-test.ts` probes are intrinsically opaque; `config-validator.ts` accepts `unknown` by design (input boundary). ~38 occurrences stay.

## Verification signal

```
$ rg ": unknown|<unknown>|as unknown|Record<string, unknown>|unknown\)" \
     -g '*.ts' -g '!**/__tests__/**' -g '!**/*.test.ts' \
     standalone-scripts | wc -l
693
```

## Proposed enforcement (companion rules, audit 16)

- Re-enable `@typescript-eslint/no-explicit-any` (already on) and add `@typescript-eslint/no-unsafe-assignment` + `no-unsafe-return` for `standalone-scripts/**`.
- `no-restricted-syntax` rule banning `TSAsExpression[typeAnnotation.typeName.name='unknown']` outside `types/**` and `**/*.d.ts`.
- CI baseline: 693 today; new PRs must not raise it. Target after top-30 pass: **≤ 360**.

## Priority backlog (rolled up to 99-backlog)

- **P0**: Class C `as unknown as` (95 sites) — highest signal-to-noise; each is a hidden type error.
- **P1**: Class A API parsing (80), Class B namespace bags (82), Class D storage (35) — architectural, but mechanical once helpers land.
- **P2**: Class E DOM coercion (34).
- **Keep**: Class F (~38) — annotated as legitimate.
