# What To Read

> Canonical map of what the AI must read before working on this project.

> Last updated: 2026-08-13T03:02:00Z

## Changelog

- 2026-08-13T03:02:00Z, Fixed TS and ESLint warnings; restored syntax correctness; achieved fully green vitest run.
- 2026-08-07T16:45:00Z, Captured RCA 06 (zero-asset releases) and the release trigger policy; cut v5.25.0.
- 2026-08-06T09:43:00Z, Performed v5.17.0 release ceremony and synchronized memory.
- 2026-08-06T09:42:00Z, Performed global .lovable memory restructure into topic folders per v3.0 enforcement.
- 2026-08-06T09:30:00Z, Updated Release prompt to v1.2 with strict Ceremony and MINOR bump enforcement.
- 2026-08-06T09:40:00Z, Implemented Write-Memory v3.0 (Maximum Enforcement) and unified .lovable folder structure.
- 2026-07-27T05:45:00Z, SUPERSEDED: Git tag is now the single source of truth for the release version.
- 2026-07-21T09:15:00Z, Captured chip-gear Re-seed defaults flow.

## Before any task (always)

- `.lovable/memory/index.md`, why: core rules, topic index, and recent workflow state.
- `.lovable/memory/standards/01-coding-guidelines.md`, why: 15 rules, function size caps, and naming conventions.
- `.lovable/memory/constraints/01-rules.md`, why: consolidated hard prohibitions (banned identifiers, no Supabase, no em dashes).
- `.lovable/plans/index.md`, why: prioritized roadmap and active task status.
- `.lovable/strictly-avoid.md`, why: legacy prohibitions pointer (re-synced to rules.md).
- `.lovable/ambiguous-questions/01-new-ambiguity/`, why: open questions that must be resolved.
- `.lovable/what-to-read.md`, why: this file (read-list synchronization).
- `readme.md`, why: project overview and monorepo structure.

## Before writing code

- `.lovable/memory/standards/01-coding-guidelines.md`
- `.lovable/memory/constraints/01-rules.md`
- `spec/02-coding-guidelines/`

## Before touching CI/CD or cutting a release

- `.lovable/memory/rca/06-release-published-without-assets.md`, why: the three causes of zero-asset releases, and the rule that a workflow diff never proves a release works. Verify through the Actions API: the run, its jobs, and the release asset list.
- `.lovable/memory/constraints/release-workflow-triggers.md`, why: `release.yml` must fire exactly once per tag. No bare `create:`, `release:` types limited to `published`.
- `.lovable/memory/constraints/chrome-extension-dist-path.md`, why: the extension build output is `chrome-extension/`, never `chrome-extension/dist/`.
- `.lovable/how-to-release.md`, why: the ceremony steps and pin sites.
- `pipeline/02-ci-workflow.md` and `pipeline/05-build-chain.md`, why: the job graph and the mandatory build order.
- `scripts/check-release-assets.mjs`, why: the post-publish gate that fails a release missing the extension or prompts zip.

## Before adding a feature

- `spec/21-app/` or `spec/26-macro-controller/`
- `.lovable/plan.md` (legacy) or `.lovable/plans/index.md`

## Before writing a spec

- `spec/01-spec-authoring-guide/`
- `spec/00-overview.md`

## Before adding a unit test

- `vitest.config.ts`
- `src/**/__tests__/`

## See also

- Root `readme.md` (must stay in sync with this file)