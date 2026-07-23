# 01 - TypeScript strictness audit

Scope: `standalone-scripts/**/*.ts` (excluding `__tests__/`, `*.test.ts`, `dist/`, `node_modules/`).
Specs applied: `spec/02-coding-guidelines/02-typescript/**`, `mem://standards/unknown-usage-policy`, `mem://standards/type-safety-standards`.

## Rollup

| Category | Occurrences | Severity |
|----------|------------:|:--------:|
| `any` type annotations (real, excluding docs/comments) | **0** | — |
| `@ts-ignore` / `@ts-expect-error` | **0** | — |
| `@ts-nocheck` files | **0 in prod** (1 historical comment reference in `index.ts:12`) | — |
| `unknown` used outside `CaughtError` | **~381 matches, ~120 legitimate, ~261 candidates for review** | P2 |
| Top-level `readonly` on public interfaces | Not measured this pass | — |

## Finding TS-01 — `unknown` overuse (P2, 261 candidate sites)

Rule: `mem://standards/unknown-usage-policy` restricts `unknown` to `CaughtError` shape. Every other `unknown` should be a proper discriminated type or `Record<string, JsonValue>`.

**Concentrated in:**

| File | Count | Nature |
|------|------:|--------|
| `marco-sdk/src/self-namespace.ts` | 14 | Public SDK surface: `kv.get`, `config.get`, `notify.toast(opts?: unknown)`. Should expose typed generics `<T>` and let callers pin the type. |
| `macro-controller/src/startup.ts` | 14 | Window namespace globals typed as `unknown`. Root cause: `globals.d.ts` declares them as `unknown`. Needs a `MacroExtWindow` discriminated interface. |
| `marco-sdk/src/self-test.ts` | 11 | Observed values from bridge; acceptable if narrowed downstream — spot-check narrowing at lines 217, 282, 310, 348. |
| `macro-controller/src/startup-idempotent-check.ts` | 11 | Cast of `window.__macroLoopVersion` etc. through `as unknown as string`. Replace with a typed window shape. |
| `macro-controller/src/auth-resolve.ts` | 11 | `resolveToken()` intermediate values. Bridge should return `AuthTokenResponse \| null`, not `unknown`. |
| `macro-controller/src/ws-members-mutations.ts` | 10 | Response bodies. Add a `WsMemberMutationResponse` type. |
| `macro-controller/src/globals.d.ts` | 10 | Declaration file. Highest leverage: fixing this collapses many downstream `unknown` uses. |
| `macro-controller/src/ws-move.ts` | 9 | Response bodies + callback params. |
| `macro-controller/src/settings-store.ts` | 9 | Setting values pulled from `chrome.storage.local`. Model as `SettingsShape` union. |
| `macro-controller/src/api-namespace.ts` | 9 | Namespace API return types. |

**Legitimate uses (~120)**: JSON parse boundaries, `catch (e: unknown)`, MessageChannel/bridge boundaries where the type is genuinely opaque and narrowed at the very next line. These stay.

## Finding TS-02 — `@ts-nocheck` historical reference (P2, 1 site)

`macro-controller/src/index.ts:12` has a comment "The entire controller is in a single file with @ts-nocheck." Grep confirms the actual `@ts-nocheck` directive is NO LONGER present in any file under `standalone-scripts/**`. Action: delete or update the stale comment. **Not a real violation, just documentation drift.**

## Finding TS-03 — `any` in prose (P2, 3 comment matches)

Grep for `any` matched 3 lines, all inside comments/docstrings (not type annotations):
- `macro-controller/src/ui/prompt-llm-guide-download.ts:18,38` — audience description ("any LLM…", "any RFC-4122 UUID").
- `macro-controller/src/ui/task-next-ui.ts:353` — comment "any failed cycle".

**Not real violations.** Regex-match false positives. No action.

## Findings absent (proof of no drift)

- Zero `: any` type annotations in production code.
- Zero `@ts-ignore` / `@ts-expect-error` / active `@ts-nocheck`.
- Zero `any[]`, `<any>`, `as any` in production code.

## Remediation hint (order of leverage)

1. `macro-controller/src/globals.d.ts` — collapses ~30 downstream `unknown` uses.
2. `marco-sdk/src/self-namespace.ts` — generics on `kv`/`config`/`notify` collapse the whole marco-sdk row.
3. `macro-controller/src/startup*.ts` — typed window shape.
4. Delete stale `@ts-nocheck` reference in `index.ts:12`.
