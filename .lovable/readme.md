# .lovable/ — AI Entry Index

Read this file first. Then `MAP.md` for path-level detail. Then targeted files only when needed.

**Project:** Marco / Macro Controller (Chromium MV3, TypeScript, Vite, sql.js, React 18 preview UI).
**Owner:** Riseup Asia LLC. **Current version:** pinned in root `readme.md`.
**Timezone:** always render in user's local zone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Never hardcode.

## Read order (fresh session)

1. `.lovable/README.md` (this file)
2. `.lovable/MAP.md` (path map)
3. `.lovable/rules.md` (hard prohibitions)
4. `.lovable/memory/index.md` (always-in-context core rules)
5. `.lovable/plan.md` (active backlog)
6. `.lovable/plans/pending/` (next work units)
7. Targeted spec under `spec/` only when the task requires it.

## Hard constraints (also in `rules.md`)

- No Supabase, ever. Storage = sql.js + OPFS + `chrome.storage.local`.
- Dark-only theme. No light mode, no toggle.
- No retry / no exponential backoff. Sequential fail-fast only.
- Zero ESLint warnings/errors.
- No `unknown` outside `CaughtError`. Defensive `?.` / `??` everywhere.
- Read-only folders: `skipped/`, `.release/`.
- No CI notifications.
- Unified versioning across `manifest.json`, `src/shared/constants.ts`, every `instruction.ts` + `shared-state.ts`, and root `readme.md`.
- `readme.txt` is off-limits for time/clock/git-stamp content.

## Canonical JSON sources (edit source, not JSON)

| JSON | Source | Generator |
|---|---|---|
| `standalone-scripts/macro-controller/02-macro-controller-config.json` | `src/config-validator.ts` | in-build |
| `standalone-scripts/macro-controller/03-macro-prompts.json` | `standalone-scripts/prompts/<NN-slug>/{prompt.md,info.json}` | `scripts/aggregate-prompts.mjs` |
| `standalone-scripts/macro-controller/04-macro-theme.json` | `less/` + `config-validator.ts` | in-build |
| `standalone-scripts/<script>/dist/instruction.json` | `src/instruction.ts` | `scripts/compile-instruction.mjs` |
| `standalone-scripts/macro-controller/dist/templates.json` | `templates/*.html` | `scripts/compile-templates.mjs` |

## How-tos

- **New prompt slide:** create `standalone-scripts/prompts/NN-<slug>/{prompt.md,info.json}` → `node scripts/aggregate-prompts.mjs` → bump version → changelog.
- **New config key:** default in `config-validator.ts` → seed JSON → spec entry under `spec/26-macro-controller/` or `spec/06-seedable-config-architecture/` → unit test → version bump.
- **New standalone script:** scaffold `standalone-scripts/<name>/{src/instruction.ts,build entry}` → register in build → register injection in `src/background/` → spec + memory entry.
- **New feature (end-to-end):** spec → `plan.md` row → code (guidelines) → matching test → memory entry if new contract → changelog + version bump.
- **New spec:** slot 01-20 = foundations, 21+ = app tier. Follow `spec/01-spec-authoring-guide/`. Cross-ref in `spec/00-overview.md`.

## Reusable AI prompts (canonical mirrors)

Live under `.lovable/prompts/`. Trigger by phrase:

| Prompt | File | Trigger phrases |
|---|---|---|
| Write Memory v3.0 | `prompts/03-write-memory.md` | `write memory`, `end memory`, `update memory` |
| No-Questions Mode | `prompts/04-no-questions.md` | `no question`, `no-questions mode` |
| Read Memory | `prompts/05-read-memory.md` | `read memory`, `recall memory` |
| Logo Create | `prompts/06-logo-create.md` | `create logo`, `make logo`, `logo` |
| Proofread | `prompts/07-proofread.md` | `proofread`, `rewrite`, `next` (in proofread mode) |
| Bump Version | `prompts/08-bump-version.md` | `bump version`, `release bump` |
| Coding Guidelines | `prompts/09-coding-guidelines.md` | `coding guidelines` |
| Lowercase Readme + `NN-kebab.md` | `prompts/10-lowercase-readme-and-sequence.md` | `lowercase readme`, `sequence slugs` |

Convention: `NN-<slug>.md`, versioned inline (`version: X.Y`). Every prompt referenced here.

## Where tests live

- Extension unit/regression: `src/**/__tests__/*.test.ts(x)`
- Standalone-script unit: `standalone-scripts/<name>/src/__tests__/*.test.ts`
- Standalone-script E2E: `standalone-scripts/<name>/tests/e2e/**/*.test.ts`
- Playwright integration: `tests/` (root)
- Vitest config: `vitest.config.ts`
- Every feature/fix ships with a matching test (see `mem://preferences/test-with-features`).

## Lifecycle summary

- Plans: `plans/pending/XX-<slug>.md` -> `mv` to `plans/completed/XX-<slug>.md`, flip `Status:` frontmatter. Subtasks under `plans/subtasks/XX-<slug>/NN-<subslug>.md`.
- Issues: `issues/open/` → `issues/closed/` on resolution.
- CI/CD incidents: `cicd/issues/` (resolved kept — they recur).
- Ambiguity log: `question-and-ambiguity/` (No-Questions Mode).

## Also see

- `plan.md` — living roadmap.
- `coding-guidelines.md` — function size, naming, error handling.
- `memory/index.md` — full memory index (always in context).
- `MAP.md` — path-to-purpose map for the whole `.lovable/` tree.
