---
name: Prompts authoring, release, and {{n}} substitution
description: How to add/edit/release macro-controller dropdown prompts and how {{n}} flows from info.json to the Plan/Next chip bodies
type: feature
---

Single reference for anyone touching prompts. If this file and the code disagree, the code wins; update this file in the same turn.

## 1. Folder layout (source of truth)

- Canonical bodies: `standalone-scripts/prompts/NN-<slug>/{prompt.md, info.json}`.
- Aggregated JSON (generated, do not hand-edit): `standalone-scripts/macro-controller/03-macro-prompts.json`.
- Aggregator: `node scripts/aggregate-prompts.mjs`.
- Human mirrors (for `.lovable/prompts/` dropdown / doc surface): `.lovable/prompts/NN-<slug>.md`.
- Mirror manifest: `.lovable/prompt-mirrors.json`, enforced by `scripts/check-prompt-mirrors.mjs`.
- Registry spec: `spec/01-prompt-spec-2026/04-dropdown-prompts-registry.md`. Related memory: `mem://prompts/dropdown-prompts-registry`.

## 2. `info.json` fields actually used

`Id`, `Title`, `Slug`, `Version`, `Author`, `Categories[]`, `IsDefault`, `Order`, `IsDynamic`, `ReplaceKey`, `ReplaceValues[]`, `SlugTemplate`, `CreatedAt`, `UpdatedAt`. Optional freeform notes: `SlugRenamedNote`, `TokenSyntaxNote`.

Dynamic prompts (chips with `{{n}}`) MUST set `IsDynamic: true`, `ReplaceKey: "n"`, `ReplaceValues` (string array of allowed N), and `SlugTemplate` containing `{{n}}` (e.g. `next-{{n}}-steps`, `plan-{{n}}`).

## 3. Add a new prompt (end to end)

1. `mkdir standalone-scripts/prompts/NN-<slug>/` (next free NN in that folder).
2. Write `prompt.md` (body) and `info.json` (fields above).
3. If user-facing in the dropdown, also add `.lovable/prompts/XX-<slug>.md` mirror and append a row to `.lovable/prompt-mirrors.json`.
4. Run `node scripts/aggregate-prompts.mjs` to regenerate `03-macro-prompts.json`.
5. Run `node scripts/check-prompt-mirrors.mjs` and `node scripts/check-prompts-info-json.mjs` locally.
6. Bump `version.json` (MINOR for a new prompt, PATCH for a body-only edit that keeps the same semantics).
7. Add a changelog entry citing the canonical path, mirror path, and version.

## 4. Release

- Release surface = one edit to `version.json`. Optional matching `v*` git tag.
- Never re-add CI stale-version / release-readiness / asset-manifest checkers. See `mem://workflow/19-release-runbook-and-failure-modes`, `mem://constraints/version-json-single-source-of-truth`.
- `readme.txt` is off-limits (no timestamps, no autowrites). See `mem://constraints/readme-txt-prohibitions`.

## 5. `{{n}}` substitution pipeline (Plan + Next chips + dropdown)

Canonical bodies today:
- `standalone-scripts/prompts/13-next-tasks/prompt.md` (v3.3.0) — `ReplaceValues ["1","2","3","4","5","8"]`, `SlugTemplate next-{{n}}-steps`.
- `standalone-scripts/prompts/14-plan-steps/prompt.md` (v4.1.0) — `ReplaceValues ["5","8","10","12","15","20","25","30","35","40","45","50","100"]`, `SlugTemplate plan-{{n}}`.

Substitution helper of record: `standalone-scripts/macro-controller/src/utils/token-substitute.ts` -> `substituteNextValue`. Replaces `{{n}}`, `{{N}}`, `${n}`, `${N}` regardless of stored `ReplaceKey` case. Do NOT add a sixth substitution site; call this helper.

Current call sites (five, all wired):
1. `standalone-scripts/macro-controller/src/ui/next-inline-ui.ts` `findNextVariant()` — Next chip fallback path.
2. `standalone-scripts/macro-controller/src/ui/task-next-ui.ts` — older Task Next paste path.
3. `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts` `buildPlanTaskPrompt(n)` — Plan chip.
4. `standalone-scripts/macro-controller/src/seed/plan-next-prompts.ts` — `PLAN_DEFAULT_BODY` / `NEXT_DEFAULT_BODY` seed + `PLAN_DEFAULT_LEGACY_BODIES` / `NEXT_DEFAULT_LEGACY_BODIES` upgrade path.
5. Runtime injector path via the aggregated `03-macro-prompts.json` -> chip dispatch.

Guards that expect `{{n}}` to survive:
- `standalone-scripts/macro-controller/src/db/rule-zero-validator.ts`: bodies still containing `{{n}}` return `template`, exempt from step-count save gate.
- `standalone-scripts/macro-controller/src/seed/prompt-health-check.ts`: `getRequiredTokensForRole('plan'|'next')` includes `{{n}}`; missing token flags `missing-required-token` at boot.

Any edit to Plan/Next default bodies MUST keep `{{n}}` present or the health check will scream.

## 6. Regression tests to run when touching prompts

- `standalone-scripts/macro-controller/src/utils/__tests__/token-substitute.test.ts`
- `standalone-scripts/macro-controller/src/ui/__tests__/task-next-token-substitution.test.ts`
- `standalone-scripts/macro-controller/src/__tests__/inline-strip-decoupled.test.ts`
- `standalone-scripts/macro-controller/src/seed/__tests__/prompt-health-check.test.ts`
- `src/__tests__/prompt-mirrors.test.ts`, `src/__tests__/prompt-parity-check.test.ts`
- `src/__tests__/next-tasks-prompt.e2e.test.ts`, `src/__tests__/plan-prompt-token-replacement.e2e.test.ts`

## 7. Do not

- Do not archive per-invocation copies of Plan/Next prompt bodies under `.lovable/prompts/`.
- Do not add a new substitution site; call `substituteNextValue`.
- Do not change `ReplaceKey` away from `"n"` for existing dynamic prompts (token-substitute handles case, but DB rows and legacy `ReplaceKey="N"` records assume lowercase key going forward).
- Do not release mid-plan from a next-task turn (see `standalone-scripts/prompts/13-next-tasks/prompt.md` RULE 1).