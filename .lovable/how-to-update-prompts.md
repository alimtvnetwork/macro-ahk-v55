# How to update a dropdown prompt

Canonical procedure for changing any of the seeded prompts (Plan, Next, Read Memory, Write Memory, Release, Coding Guidelines, etc.). Follow every step. Skipping any step = stale UI buttons, mirror drift, or failed CI.

## Locations (single source of truth)

1. **Canonical prompt body**: `standalone-scripts/prompts/XX-<slug>/prompt.md`
2. **Metadata**: `standalone-scripts/prompts/XX-<slug>/info.json` (`Version`, `UpdatedAt`, `Slug`, `Id`)
3. **Chat-side mirror** (verified by `scripts/check-prompt-mirrors.mjs`): `.lovable/prompts/NN-<slug>.md`
4. **Aggregated bundle**: `chrome-extension/prompts/macro-prompts.json` (generated, do not hand-edit)
5. **Runtime DB defaults** for `plan-default` / `next-default` only: `standalone-scripts/macro-controller/src/seed/plan-next-prompts.ts` constants `PLAN_DEFAULT_BODY` / `NEXT_DEFAULT_BODY` plus the `legacyBodies` upgrade lists in `seed-plan-next.ts`.
6. **Content tests**: `src/__tests__/default-prompt-content.test.ts` (and any prompt-specific spec under `src/__tests__/` or `standalone-scripts/macro-controller/src/seed/__tests__/`).

## Steps (in order, fail-fast)

1. **Edit the canonical body** at `standalone-scripts/prompts/XX-<slug>/prompt.md`. Paste the user text verbatim. No em/en dashes.
2. **Bump `info.json`**: increment `Version` (semver, MAJOR when contract changes), set `UpdatedAt` to `date -u +%Y-%m-%dT00:00:00Z`. Keep `Slug` and `Id` stable, never rename.
3. **Update the mirror** `.lovable/prompts/NN-<slug>.md`. Simplest: `cp standalone-scripts/prompts/XX-<slug>/prompt.md .lovable/prompts/NN-<slug>.md`. Body must match byte-for-byte (`check-prompt-mirrors.mjs` diffs them).
4. **For Plan / Next only**, also update `PLAN_DEFAULT_BODY` or `NEXT_DEFAULT_BODY` in `standalone-scripts/macro-controller/src/seed/plan-next-prompts.ts`, and append the prior body verbatim to the corresponding `legacyBodies` array in `seed-plan-next.ts` so existing DB rows upgrade on next boot. Other prompts do not have SQLite default rows and skip this step.
5. **Regenerate the bundle**: `node scripts/aggregate-prompts.mjs`. Commit the resulting `chrome-extension/prompts/macro-prompts.json`.
6. **Update / add content tests** in `src/__tests__/default-prompt-content.test.ts`:
   - Assert every non-negotiable phrase from the new body (rule headings, trigger phrases, RULE 0, key checklist items).
   - Assert `prompt === mirror` (byte equality).
   - Assert no em/en dashes: `expect(body).not.toMatch(/[\u2014\u2013]/)`.
   - For Plan / Next also update `standalone-scripts/macro-controller/src/seed/__tests__/seed-plan-next-*.test.ts` so the stale-row upgrade path covers the new body.
7. **Run the gates** and fix any failure before shipping:
   ```bash
   node scripts/aggregate-prompts.mjs
   node scripts/check-prompt-mirrors.mjs
   node scripts/check-prompts-info-json.mjs
   node scripts/check-prompt-info-casing.mjs
   bunx vitest run src/__tests__/default-prompt-content.test.ts
   # Plan/Next only:
   bunx vitest run standalone-scripts/macro-controller/src/seed/__tests__
   ```
   All must exit 0.
8. **Release** (only if the user asked for a release in the same turn): follow `standalone-scripts/prompts/22-release/prompt.md`. Prompt edits alone do NOT auto-trigger a version bump; the user's trigger phrase does.

## Hard rules

- Never edit `chrome-extension/prompts/macro-prompts.json` by hand. It is generated.
- Never rename `Slug` or `Id` in `info.json`. Downstream SQLite rows and localStorage order keys reference them.
- Never edit `.lovable/prompts/NN-*.md` in isolation; the canonical source is `standalone-scripts/prompts/`.
- Never skip the content test update. A prompt body change without a matching test assertion is the exact regression that has burned the user repeatedly (stale buttons, unnoticed drift).
- No em dashes (`\u2014`) or en dashes (`\u2013`) anywhere in prompt bodies, mirrors, or tests.
- For Plan / Next: always append the prior body to `legacyBodies`. Missing this = existing users see the old prompt on their existing DB rows even after the seeder runs.

## Failure modes this procedure prevents

- `check-prompt-mirrors.mjs` CI failure (mirror drift).
- `check-prompts-info-json.mjs` CI failure (bad metadata).
- UI buttons rendering old prompt bodies because `plan-default` / `next-default` SQLite rows were never upgraded.
- Silent prompt regressions merged with no test coverage.
- Aggregated `macro-prompts.json` stale in the extension build.
