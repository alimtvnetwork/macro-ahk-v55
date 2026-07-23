# 12. Dead-code & Unused-export Scan

Tool: `ts-prune -p tsconfig.macro.build.json`. Signal filters out `used in module` (self-references) to focus on truly unreferenced exports.

## Headline numbers

- **278** unused exports across **62** files in `standalone-scripts/`.
- Concentration: the top 10 files hold **181 (65%)** of all unused exports.
- No package outside `macro-controller` has more than a handful.

## Top offenders

| Rank | File                                                                  | Unused exports |
| ---- | --------------------------------------------------------------------- | -------------- |
| 1    | `macro-controller/src/types/index.ts`                                 | 90             |
| 2    | `macro-controller/src/pro-zero/index.ts`                              | 26             |
| 3    | `macro-controller/src/auth.ts`                                        | 14             |
| 4    | `macro-controller/src/credit-fetch.ts`                                | 10             |
| 5    | `macro-controller/src/workspace-rename.ts`                            | 9              |
| 6    | `macro-controller/src/ws-selection-ui.ts`                             | 8              |
| 6    | `macro-controller/src/queue-control/index.ts`                         | 8              |
| 8    | `macro-controller/src/index.ts`                                       | 7              |
| 9    | `macro-controller/src/ui/summary-bar/index.ts`                        | 6              |
| 9    | `macro-controller/src/selected-workspaces-store.ts`                   | 6              |
| 11   | `macro-controller/src/ui/sections.ts`                                 | 5              |
| 11   | `macro-controller/src/pro-zero/pro-zero-constants.ts`                 | 5              |

## Classification (P0..P2)

**P0. Barrel re-export drift (116 items, ~42%)**
`types/index.ts` (90), `pro-zero/index.ts` (26), `queue-control/index.ts` (8), `ui/summary-bar/index.ts` (6). These barrels re-export symbols that are only consumed via the source files directly, never through the barrel. Two acceptable resolutions:

1. Delete the barrel entries and let consumers import from the source file (preferred; also closes the `export *` finding in audit 11).
2. Migrate all consumers to import via the barrel, then delete the source-file exports.

Do not silence with `// ts-prune-ignore-next`.

**P1. Legacy auth/credit surface (33 items)**
`auth.ts` (14) and `credit-fetch.ts` (10), plus `workspace-rename.ts` (9). Examples flagged by ts-prune: `normalizeBearerToken`, `isJwtToken`, `isUsableToken`, `extractBearerTokenFromUnknown`, `getTokenSavedAt`, `authRecoveryManager`, `RefreshTokenOptions`, `resolveWsTier`, `applyCanceledCreditOverride`, `formatDaysAgo`, `formatDaysIn`, `WorkspaceLifecycleConfig`.

These are candidates for either:
- deletion (violates `mem://auth/unified-auth-contract` if they mirror `getBearerToken`), or
- re-consumption if a live call site was silently removed (verify with `rg` before deleting).

Action: for each of the 33 items, run `rg -w '\b<name>\b'` across the repo (including tests) and either delete or wire back. Do **not** bulk-delete without the ripgrep confirmation, because `ts-prune` misses dynamic string references and test-only imports.

**P2. Local helpers exported for tests but not imported (~50 items)**
Spread across UI files. Convert to non-exported internals and move the assertion to a public API test.

**P3. Type-only exports (~79 items)**
Interfaces/aliases only referenced within their own file. Downgrade to non-exported types unless they document a public shape.

## Cross-check with cycles (audit 11)

`ui/summary-bar/index.ts` (6 unused re-exports) is also a barrel that participates in no cycle, so deleting it is risk-free. `pro-zero/index.ts` re-exports 26 unused symbols and is a leaf, also safe to prune.

The heavy `types/index.ts` barrel (90) is the single biggest hygiene win in the repository: it feeds both the cycles audit (barrel-file finding) and this dead-code audit.

## Verification signal

```
$ npx ts-prune -p tsconfig.macro.build.json | grep -v 'used in module' | wc -l
278
$ npx ts-prune -p tsconfig.macro.build.json | grep -v 'used in module' \
    | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -1
90 standalone-scripts/macro-controller/src/types/index.ts
```

## Proposed enforcement (companion rules, see audit 16)

- Add `ts-prune` to CI with a whitelist file. Baseline is 278; new PRs must not raise it.
- ESLint `import/no-unused-modules { unusedExports: true }` on `standalone-scripts/**` after the 278-item cleanup pass.

## Priority backlog (rolled up to 99-backlog)

- **P0**: Prune `types/index.ts` barrel and 3 sibling barrels (116 items, mechanical).
- **P1**: Triage 33 auth/credit/rename items with ripgrep and delete-or-reconnect.
- **P2**: Convert 50 local helpers to internals; 79 type-only exports to non-exported.
