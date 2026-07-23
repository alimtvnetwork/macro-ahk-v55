# What to Read

> Canonical map of what the AI must read before working on this project.
> Last updated: 2026-07-21T09:15:00Z

This file is the top-level pointer. The detailed onboarding map (folder tree,
JSON contracts, how-to-add-a-prompt / config / script / test) lives in
[`.lovable/memory/what-to-read.md`](./memory/what-to-read.md) — keep both in
sync, and keep this list in sync with the root `readme.md` "Project Structure"
section.

## Changelog

- 2026-07-21T12:00:00Z: Captured version mismatch prevention: `version.json` is the only human-edited release version, manifest output is generated and guarded from it.
- 2026-07-21T09:15:00Z: Captured chip-gear `Re-seed defaults (safe)` + `Force reset defaults` auto-open-editor flow (`mem://features/macro-controller/reseed-defaults-open-editor`).
- 2026-07-19T11:11:25Z: Write-memory checkpoint after Plan 25 Steps 39-48 + subtask-naming policy shift (sequence-first, no `ss-`/`SS-` prefix). Verified read-list still matches §0 pre-flight and root readme.md.
- 2026-07-20T00:00:00Z: Added repeat-regression reminder for denied identifiers and function-size limits.
- 2026-07-18T00:00:00Z: Created canonical top-level pointer per write-memory v2 spec (§7A). Detailed map remains in `.lovable/memory/what-to-read.md`.

## Before any task (always)

- `.lovable/memory/index.md` — always-loaded core rules + full memory index.
- `.lovable/coding-guidelines.md` — function length, naming, error handling, boolean/enum rules.
- `.lovable/plan.md` — active prioritized backlog (authoritative).
- `.lovable/strictly-avoid.md` — hard prohibitions; never violate.
- `.lovable/suggestions.md` — open and closed Lovable suggestions tracker.
- `.lovable/cicd/README.md` + `.lovable/cicd/issues/` — CI/CD incident history (resolved issues recur).
- `.lovable/prompts/README.md` — prompt registry with slugs, triggers, status.
- `.lovable/memory/workflow/` — current workflow state and past session notes.
- `.lovable/rules.md` — the consolidated `.lovable/` rules (Plan-18 output).
- `spec/00-overview.md` — master index of the spec tree.

## Before writing code

- `.lovable/coding-guidelines.md` and `spec/02-coding-guidelines/` — the 26 engineering rules.
- `.lovable/memory/standards/restricted-identifiers-and-function-size.md` - repeat-regression guard for banned names (`arr`, `cb`, `fn`, `el`, `msg`, `ctx`, `obj`, `val`) and oversized functions.
- `.lovable/strictly-avoid.md` — bans (no Supabase, no light mode, no unauthorized retry, no `unknown` outside `CaughtError`, no `readme.txt` autowrites).
- `.lovable/memory/architecture/` — module boundaries, lifecycle, storage layers.
- `.lovable/memory/standards/` — error-logging, verbose-logging, timer teardown, JS-step diagnostics.

## Before adding a feature

- The relevant folder under `spec/21-app/` or `spec/26-macro-controller/` (write the spec first).
- `.lovable/plan.md` — add a row with `⏳ Pending` before implementation.
- `.lovable/memory/features/` — check for existing conventions on the surface you're touching.
- `mem://preferences/test-with-features` — every feature ships with a matching test.

## Before writing a spec

- `spec/01-spec-authoring-guide/` (v3.5.0) — required sections (Goal, Non-goals, Contracts, Acceptance, References).
- `spec/00-overview.md` — pick the correct numeric slot (01–20 foundations, 21+ app tier).
- `scripts/check-spec-prompts-xrefs.mjs` — cross-reference guard.

## Before adding a unit test

- `vitest.config.ts` — test globs and jsdom setup.
- Neighboring `__tests__/` folder for the module you're testing.
- `.lovable/memory/testing/` if present — test conventions and fixtures.
- Run `bunx vitest run <path>` for a single file; CI runs the full suite.

## Before touching CI/CD

- `.lovable/cicd/profile.md` — fast triage for "CI not running / release didn't fire".
- `.lovable/cicd/README.md` + numbered issues in `.lovable/cicd/issues/`.
- `mem://constraints/ci-push-trigger-unfiltered` — `.github/workflows/ci.yml` must stay on bare `push:`.

## Before running a release (trigger phrases: `release`, `bump version`)

- `.lovable/how-to-release.md` — MUST-follow version.json-only release checklist (defaults, ordered steps, never-do list, reporting). Every release must follow this file end to end.
- `.lovable/memory/workflow/release-ceremony.md` — canonical flow: edit `version.json` only, optionally create the matching `v*` tag.
- `.lovable/prompts/14-release.md` — release trigger prompt.
- `.lovable/memory/workflow/19-release-runbook-and-failure-modes.md` — failure mode memory: do not re-add release checkers.

## See also

- Root [`readme.md`](../readme.md) — must stay in sync with this file (same read-list, no drift).
- Detailed onboarding map: [`.lovable/memory/what-to-read.md`](./memory/what-to-read.md) — JSON contracts, how-to-add flows, folder cheat-sheet.
