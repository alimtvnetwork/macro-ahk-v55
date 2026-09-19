# 14. Companion ESLint / tsc Rule Additions

Status: **partial implementation** as of v4.110.0. Every P0 rule now has a measurable landing spot in either `eslint.audit.config.js`, `tsconfig.macro.audit.json`, or an existing/new CI script. The prod `eslint.config.js` and `tsconfig.macro.build.json` are unchanged so main CI is not disrupted; promotion is per-item and gated on the underlying debt reaching zero.

Purpose: turn the audit backlog (see `99-backlog.json`) into enforceable CI gates so regressions become build failures instead of new audit rows. Each rule ships in its own remediation PR alongside the code cleanup it enforces. Rules are keyed to backlog IDs so the PR that ships a rule also closes its backlog item.

## What was implemented (v4.110.0)

- **`eslint.audit.config.js` (new, opt-in)** layers the 10 P0 ESLint rules on top of the base config. Contributors run `npx eslint --config eslint.audit.config.js standalone-scripts/**/*.ts` to see the exact remediation queue without breaking main CI.
- **`tsconfig.macro.audit.json` (new, opt-in)** enables the 3 deferred strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`). Run `npx tsc --noEmit -p tsconfig.macro.audit.json` to see per-flag fallout.
- **`scripts/audit-p0-rules.mjs` (new)** aggregates every P0 category into `public/p0-rules-audit.json` and prints a status table. Sequential fail-fast, no retry/backoff. `--strict` exits 1 on regression.

## Verification (v4.110.0 first run)

Run: `node scripts/audit-p0-rules.mjs`

| ID     | Observed | Baseline | Status                | Category                                     |
| ------ | -------- | -------- | --------------------- | -------------------------------------------- |
| P0-01  | 139      | 187      | at-or-below-baseline  | innerHTML sinks (already down 48 vs audit)   |
| P0-02  | 1        | 1        | at-or-below-baseline  | `new Function()` (js-executor.ts:111 only)   |
| P0-03  | 0        | 1        | at-or-below-baseline  | silent IndexedDB catch in prompt-dropdown.ts |
| P0-04a | 1        | 4        | at-or-below-baseline  | unauthorized `console.error`                 |
| P0-04b | 0        | 5        | at-or-below-baseline  | unannotated silent catches                   |
| P0-05  | 0        | 10       | at-or-below-baseline  | `setInterval` bypassing tracker              |
| P0-06  | 15       | 15       | at-or-below-baseline  | raw localStorage literal keys                |
| P0-07  | 0        | 3        | informational         | packages below 0.20 test ratio               |
| P0-08  | warn     | disabled | informational         | complexity rules status                      |
| P0-09  | 0        | 0        | at-or-below-baseline  | macro-controller cycles                      |
| P0-10  | 71       | 71       | at-or-below-baseline  | `as unknown as` double-casts                 |

Regressed categories: **0**. All 10 P0 items are ratcheted at or below their v4.86.0 baselines.



## `eslint.config.js` — new rules per folder scope

### Scope: `standalone-scripts/**/*.ts`

```js
// Currently at lines 326 (max-lines-per-function) and 384 (sonarjs/cognitive-complexity)
// the standalone-scripts scope disables both. Replace with tiered per-folder caps.
{
  files: ['standalone-scripts/**/*.ts'],
  rules: {
    // P0-08 (backlog): re-enable complexity guards
    'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    'sonarjs/cognitive-complexity': ['error', 20],

    // P0-04, P0-06 (backlog): namespace logger + silent-catch discipline
    'no-console': ['error', { allow: [] }],
    // Companion: keep the local `logError` / `Logger.error` helpers; ban raw console.
    'no-empty': ['error', { allowEmptyCatch: false }],

    // P0-10, P2-06 (backlog): unknown-usage policy
    // Ban `as unknown as` outside types/**; ban `Record<string, unknown>` outside .d.ts.
    'no-restricted-syntax': [
      'error',
      {
        selector: "TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
        message: "`as unknown` is forbidden outside types/**. Add a runtime guard or extend the target type. See spec/33-missing-coding-guideline/13-unknown-usage-top30.md."
      },
      {
        // P0-01 (backlog): innerHTML sink ban
        selector: "AssignmentExpression[left.property.name='innerHTML']",
        message: "Direct .innerHTML assignment is forbidden. Use escapeHtml + typed template builder. See spec/02-coding-guidelines/11-security."
      },
      {
        // P0-02 (backlog): dynamic eval ban
        selector: "NewExpression[callee.name='Function']",
        message: "`new Function()` is forbidden. Use an explicit dispatch table."
      },
      {
        // P0-06, P1-04 (backlog): storage-key centralization
        selector: "CallExpression[callee.object.name='localStorage'][arguments.0.type='Literal']",
        message: "Raw localStorage string keys are forbidden. Use StorageKey enum from types/storage-keys.ts."
      },
      {
        // P1-03 (backlog): banned identifier
        selector: "Identifier[name='msg']",
        message: "Identifier `msg` is banned. Use `message`."
      }
    ],

    // P0-05, P1-02, P1-03 (backlog): teardown discipline is not directly ESLint-checkable
    //   -> enforced by check-timer-teardown.mjs (see below)

    // P0-10 (backlog) — unsafe assignments (partial coverage; runs on typed files only)
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',

    // Companion for P0-09 / P1-06 / P1-07 (cycles) — needs eslint-plugin-import
    'import/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }]
  }
}
```

### Scope: `standalone-scripts/**/index.ts` (barrel policy)

```js
// P2-05 (backlog): ban export * barrels
{
  files: ['standalone-scripts/**/index.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ExportAllDeclaration',
        message: '`export *` barrels are forbidden. List named exports explicitly. See spec/33-missing-coding-guideline/11-import-graph-cycles-and-barrels.md.'
      }
    ]
  }
}
```

### Scope: `standalone-scripts/macro-controller/src/ui/**/*.ts`

```js
// P1-01 (backlog): inline color literals ban.
// Full-fidelity would need stylelint or a custom AST rule; ESLint no-restricted-syntax
// catches the common cases in style-string assignments.
{
  files: ['standalone-scripts/macro-controller/src/ui/**/*.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "Literal[value=/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/]",
        message: 'Hex color literal in UI is forbidden. Use a semantic token from types/design-tokens.ts.'
      },
      {
        selector: "Literal[value=/\\brgba?\\s*\\(/]",
        message: '`rgb()` / `rgba()` literal in UI is forbidden. Use a semantic token.'
      }
    ]
  }
}
```

## `tsconfig.macro.build.json` — strictness tightening

```jsonc
{
  "compilerOptions": {
    // Already on: "strict": true
    // Add:
    "noUncheckedIndexedAccess": true,   // P0-10 companion; kills a whole class of `.foo!` casts
    "exactOptionalPropertyTypes": true, // P1-09 companion; forces API parsers to be explicit
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

Each of these will surface errors that must be fixed **before** the flag is enabled repo-wide; land per-file with `// @ts-expect-error` cleanup passes if needed.

## CI check scripts (new; sequential, fail-fast per `mem://constraints/no-retry-policy`)

| Script | Enforces | Backlog item | Failure signal |
| ------ | -------- | ------------ | -------------- |
| `scripts/check-madge-cycles.mjs` | 0 cycles per package (57 today in `macro-controller`) | P0-09, P1-06, P1-07, P2-04 | Exit 1 if cycles count exceeds baseline JSON |
| `scripts/check-ts-prune.mjs` | Unused exports baseline (278 today) | P1-08, P2-05 | Exit 1 if count rises |
| `scripts/check-unknown-usage.mjs` | 693 baseline; target 360 post-cleanup | P0-10, P1-09, P1-10, P2-06 | Exit 1 if count rises |
| `scripts/check-file-loc-ceiling.mjs` | Soft 800, hard 1200 per file | P1-05 | Warn > 800, fail > 1200 |
| `scripts/check-timer-teardown.mjs` | `setInterval`/`MutationObserver` paired with `pagehide` teardown | P0-05, P1-02, P1-03 | Exit 1 on unpaired timer/observer owners |
| `scripts/check-test-with-features.mjs` | Every package prod:test ratio ≥ 0.20 | P0-07, P1-11 | Exit 1 if any package regresses |
| `scripts/check-storage-key-centralization.mjs` | Zero raw `localStorage` string literals outside `types/storage-keys.ts` | P0-06, P1-04 | Exit 1 on match |

All scripts follow the sequential fail-fast pattern from `mem://constraints/no-retry-policy` — no backoff, no per-file skips. Baselines are stored in `spec/33-missing-coding-guideline/99-baselines.json` (added by task 20 close-out).

## Rollout order (matches backlog priority)

1. **PR A** — `import/no-cycle` + `check-madge-cycles.mjs` after P0-09 land (cluster 1 broken).
2. **PR B** — `no-restricted-syntax` for `innerHTML` + `new Function()` after P0-01 / P0-02 land.
3. **PR C** — `no-restricted-syntax` for `localStorage` literal + `check-storage-key-centralization.mjs` after P0-06 / P1-04 land.
4. **PR D** — `no-empty` (`allowEmptyCatch: false`) + `no-console` after P0-03 / P0-04 land.
5. **PR E** — `no-restricted-syntax` `as unknown` ban + `check-unknown-usage.mjs` after P0-10 Class-C sweep.
6. **PR F** — `max-lines-per-function` + `sonarjs/cognitive-complexity` re-enable + `check-file-loc-ceiling.mjs` after P1-05 splits.
7. **PR G** — `check-test-with-features.mjs` after P0-07 / P1-11 land.
8. **PR H** — Barrel `no-restricted-syntax` after P2-05 prune.
9. **PR I** — tsconfig strictness flags one at a time; each after its class is clean.

## Non-goals for this draft

- No rule is enabled here. Every diff above is the *proposed* change for a follow-up remediation PR.
- No `--fix` autofixers are proposed; each violation deserves human review, especially the 95 `as unknown as` sites.
- No file is renamed or moved.

## Verification signal (proves the draft matches reality)

Every backlog item referenced above (P0-01 … P2-06) exists in `spec/33-missing-coding-guideline/99-backlog.json` at v4.86.0. To validate:

```
$ node -e "const b=require('./spec/33-missing-coding-guideline/99-backlog.json'); \
    const ids=new Set(b.items.map(i=>i.id)); \
    for (const ref of ['P0-01','P0-02','P0-03','P0-04','P0-05','P0-06','P0-07','P0-08','P0-09','P0-10', \
                       'P1-01','P1-02','P1-03','P1-04','P1-05','P1-06','P1-07','P1-08','P1-09','P1-10','P1-11', \
                       'P2-04','P2-05','P2-06']) \
      if (!ids.has(ref)) { console.error('MISSING', ref); process.exit(1); } \
    console.log('all rule cross-refs resolve');"
```
