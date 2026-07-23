## Fix CI: 1 ESLint warning + 47 Vitest failures

### 1. ESLint `sonarjs/prefer-immediate-return` in `token-substitute.ts:51`

Collapse the `aliased` temp:

```ts
return alternateKey ? primary.replace(buildTokenRegex(alternateKey), valueText) : primary;
```

### 2. Vitest failures (47) — two clusters, same root causes as Issue 15

**Cluster A: timeouts (~44 tests)** in suites that mock the old bridge module.

Files (from failure list):
- `src/db/__tests__/prompt-db-rename.test.ts`
- `src/seed/__tests__/seed-plan-next.test.ts`
- any other suite still mocking `../../ui/prompt-loader` or the pre-refactor bridge

Root cause: `db/*` now reads via `db/sql-bridge.ts` -> `db/extension-bridge.ts`. Tests still mock `ui/prompt-loader` (or equivalent), so `sendToExtension` never resolves and the 5s timeout hits.

Fix: switch each failing suite's `vi.mock(...)` target to `../extension-bridge` (or relative equivalent), keep the `responsesQueue` shape, drop unused `buildPromptLoaderMock` imports. This is the same pattern already applied to `migrate-legacy-read-memory.test.ts` in the prior turn — replicate it.

**Cluster B: `defaultsProtected` shape drift (~3 tests)** in `prompt-io-db-bridge-commit.test.ts` (C1, C6, and any sibling).

Root cause: `commitDbEntries` now returns `{ upserted, errors, defaultsProtected }`. Tests still assert the 2-key shape.

Fix: update assertions from
```ts
expect(res).toEqual({ upserted: 1, errors: [] });
```
to
```ts
expect(res).toEqual({ upserted: 1, errors: [], defaultsProtected: 0 });
```
across the 3 failing cases. No production change (shape is intentional per the v4.400.0 defaults-protection work).

### 3. Verification

- `npx eslint standalone-scripts --max-warnings=0`
- `pnpm run test:quiet` (or targeted: the 5 changed test files first)
- `npx tsc --noEmit -p tsconfig.macro.build.json`

All three must exit 0.

### 4. Bookkeeping

- Close `.lovable/issues/open/15-vitest-55-failures-post-bridge-refactor.md` note: the 47 failures here are the residual same-family cases the previous turn didn't sweep. Add a follow-up line to Issue 15 (or a new `16-*.md`) recording that a repo-wide grep for `vi.mock('../../ui/prompt-loader'` and for `toEqual({ upserted:` was performed to prevent a third recurrence.

### Enumeration step (first action in build mode)

Before editing, run:
```
rg -l "ui/prompt-loader'" standalone-scripts/macro-controller/src --glob '*.test.ts'
rg -n "toEqual\\(\\{ upserted" standalone-scripts/macro-controller/src --glob '*.test.ts'
```
to confirm the full set of files matches the failure list and catch any not shown in the truncated CI log.
