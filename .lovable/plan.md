## Goal

Document, in one place, how prompts work in this repo end to end: authoring, mirroring, releasing, and how the `{{n}}` token is substituted for the Plan and Next chip buttons + dropdown. No code changes. Deliverable is a single memory file the next session can read.

## Current state (verified this turn)

- Canonical prompt bodies live under `standalone-scripts/prompts/NN-<slug>/` with `prompt.md` + `info.json`. Aggregator: `scripts/aggregate-prompts.mjs` -> `standalone-scripts/macro-controller/03-macro-prompts.json`.
- Human mirrors live under `.lovable/prompts/NN-<slug>.md`. Mapping is `.lovable/prompt-mirrors.json` (10 entries today), enforced by `scripts/check-prompt-mirrors.mjs`.
- Plan / Next defaults today:
  - `standalone-scripts/prompts/13-next-tasks/prompt.md` v3.3.0, `ReplaceKey: "n"`, `ReplaceValues: ["1","2","3","4","5","8"]`, `SlugTemplate: next-{{n}}-steps`.
  - `standalone-scripts/prompts/14-plan-steps/prompt.md` v4.1.0, `ReplaceKey: "n"`, `ReplaceValues: ["5","8","10","12","15","20","25","30","35","40","45","50","100"]`, `SlugTemplate: plan-{{n}}`.
- `{{n}}` substitution paths (all currently wired):
  - `standalone-scripts/macro-controller/src/utils/token-substitute.ts` replaces `{{n}}`, `{{N}}`, `${n}`, `${N}` regardless of stored `ReplaceKey` case.
  - `standalone-scripts/macro-controller/src/ui/next-inline-ui.ts` `findNextVariant()` runs `substituteNextValue` on matched `next-N-steps` bodies.
  - `standalone-scripts/macro-controller/src/ui/task-next-ui.ts` applies `{{n}}` / `${n}` substitution on the older Task Next paste path.
  - `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts` `buildPlanTaskPrompt(n)` substitutes `{{n}}` in the shared `PLAN_DEFAULT_BODY`.
  - Seed side: `standalone-scripts/macro-controller/src/seed/plan-next-prompts.ts` inlines `PLAN_DEFAULT_BODY` / `NEXT_DEFAULT_BODY` with `{{n}}`; upgrades from `PLAN_DEFAULT_LEGACY_BODIES` / `NEXT_DEFAULT_LEGACY_BODIES`.
  - Rule-0 validator (`db/rule-zero-validator.ts`) treats bodies still containing `{{n}}` as `template` (deferred to inject-time), so save-gate does not reject them.
  - Health check (`seed/prompt-health-check.ts`) verifies each role's DB row still carries required `{{n}}` token.
- No open issue mentions a raw `{{n}}` leak; per the user's answer, no fix is needed this turn.

## Plan

1. Read the currently-checked-in default bodies + info.json for `13-next-tasks` and `14-plan-steps`, plus the substitution files listed above, and the aggregator + mirror checker scripts. (No writes.)
2. Read `.lovable/prompt-mirrors.json`, `scripts/check-prompt-mirrors.mjs`, `scripts/aggregate-prompts.mjs`, and the release ceremony memory (`mem://workflow/release-ceremony`, `mem://workflow/19-release-runbook-and-failure-modes`, `mem://constraints/version-json-single-source-of-truth`).
3. Write a single memory file `.lovable/memory/features/prompts-authoring-and-release.md` that captures, in order:
  - Folder layout (canonical vs mirror) and file contract (`prompt.md` + `info.json` schema fields actually used: `Id`, `Title`, `Slug`, `Version`, `Categories`, `IsDefault`, `Order`, `IsDynamic`, `ReplaceKey`, `ReplaceValues`, `SlugTemplate`, `CreatedAt`, `UpdatedAt`).
  - How to add a new prompt (create folder, add `prompt.md` + `info.json`, add mirror + entry in `prompt-mirrors.json` if user-facing, run `node scripts/aggregate-prompts.mjs`, bump `version.json`, add changelog).
  - How to release prompt changes (edit `version.json` only; optional `v*` tag; never re-add release checkers; never touch `readme.txt`).
  - How `{{n}}` flows: `info.json.ReplaceKey` + `ReplaceValues` -> chip labels via `SlugTemplate` -> body substitution in the five files above -> Rule-0 validator template exemption -> health check assertion. Note that `ReplaceKey` case is now irrelevant (token-substitute handles both).
  - Cross-references to specs: `spec/01-prompt-spec-2026/04-dropdown-prompts-registry.md`, existing `mem://prompts/dropdown-prompts-registry`.
4. Add one row to `.lovable/memory/index.md` Memories pointing at the new file.
5. No `plan.md` change, no plan/subtask files, no code changes, no version bump.

## Technical details

- File to create: `.lovable/memory/features/prompts-authoring-and-release.md` with frontmatter `type: feature`.
- Index update: append single bullet under `## Memories` in `.lovable/memory/index.md`.
- Substitution helper of record: `standalone-scripts/macro-controller/src/utils/token-substitute.ts` (`substituteNextValue`). All new paths should call it; do not add a sixth substitution site.
- Required-token registry for health-check: `getRequiredTokensForRole(role)` in the seed module — any future default-body edit must keep `{{n}}` present or the health check will flag `missing-required-token`.

## Out of scope (explicitly)

- No refactor of the five substitution sites into one call site.
- No new prompt, no version bump, no changelog entry.
- No changes to Plan / Next default bodies or their info.json.
- No `.lovable/plans/` file created (per user answer: comprehension only).  
  
# Read Memory (Enhanced)
  &nbsp;
  ## Ambiguity folder path (non-negotiable)
  &nbsp;
  - Open questions: `.lovable/ambiguous-questions/01-new-ambiguity/XX-<slug>.md`
  - Answered questions: `.lovable/ambiguous-questions/02-ambiguity-resolved/XX-<slug>.md`
  &nbsp;
  Read both folders in full during Phase 1. Surface open-ambiguity counts and slugs in the Completion Confirmation block. Treat resolved-ambiguity files as binding project decisions, do not re-litigate them. If an open ambiguity is relevant to the incoming task, stop and surface it before doing work; never guess past it.
  &nbsp;
  ## Goal
  &nbsp;
  Before you touch this project, load its identity into your head: who it is, what it forbids, what it has already decided, and what work is in flight.
  &nbsp;
  The specs and the `.lovable/` folder are the single source of truth. Your training data is not. If the two disagree, the repo wins, every time.
  &nbsp;
  You are done reading when you can, without guessing:
  &nbsp;
  - name the CODE RED rules,
  - name the naming, error-handling, and DB conventions,
  - list what is currently in `.lovable/plans/pending/`,
  - point at the exact file that justifies any rule you enforce.
  &nbsp;
  If you cannot do that, keep reading. Do not start work.
  &nbsp;
  ---
  &nbsp;
  ## Phase 1 - Load the project
  &nbsp;
  ### 1.1 Read the whole `.lovable/` folder
  &nbsp;
  Walk `.lovable/` recursively. Every file matters. Missing files are noted, not silently skipped. In particular:
  &nbsp;
  | #   | Path                                                  | What you get                                                                                                                                |
  | --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
  | 1   | `.lovable/overview.md`                                | Project summary, stack, nav map                                                                                                             |
  | 2   | `.lovable/strictly-avoid.md`                          | Hard prohibitions (CODE RED)                                                                                                                |
  | 3   | `.lovable/user-preferences`                           | How the human wants you to behave                                                                                                           |
  | 4   | `.lovable/what-to-read.md`                            | **Authoritative reading order** for this project. If it exists, it overrides the generic order in this prompt. Read it first and follow it. |
  | 5   | `.lovable/prompt.md` + `.lovable/prompts/`            | Canonical prompts (Read, Plan, etc.). "Read memory" = run this prompt.                                                                      |
  | 6   | `.lovable/memory/index.md`                            | Index of institutional knowledge. Then read every file it references, recursively.                                                          |
  | 7   | `.lovable/plans/index.md`                             | Roll-up of all plans (pending + completed + subtasks). Read this before touching individual plan files.                                     |
  | 8   | `.lovable/plans/pending/`                             | Active plans, `XX-<slug>.md`                                                                                                                |
  | 9   | `.lovable/plans/completed/`                           | Recent history, skim only                                                                                                                   |
  | 10  | `.lovable/plans/subtasks/XX-<slug>/`                  | Depth files linked from a parent plan                                                                                                       |
  | 11  | `.lovable/suggestions.md`                             | Ideas not yet approved                                                                                                                      |
  | 12  | `.lovable/spec/commands/`                             | User commands and conventions, `XX-<slug>.md`                                                                                               |
  | 13  | `.lovable/issues/`                                    | General bugs and regressions                                                                                                                |
  | 14  | `.lovable/cicd-issues/`                               | CI/CD-specific failures. Read ALL of these before any code change so you do not repeat the same mistakes.                                   |
  | 15  | `.lovable/ambiguous-questions/01-new-ambiguity/`      | Open questions currently blocking work. If any exist, surface them in the completion block, do NOT guess past them.                         |
  | 16  | `.lovable/ambiguous-questions/02-ambiguity-resolved/` | Answered questions with their applied solution. Treat these as binding decisions, do not re-litigate.                                       |
  | 17  | Anything else under `.lovable/`                       | Read it. If the folder exists, it exists for a reason.                                                                                      |
  &nbsp;
  ### 1.2 The two index files
  &nbsp;
  Two indexes decide what you read next. Treat them as required entry points, not as summaries:
  &nbsp;
  - `.lovable/memory/index.md` lists every institutional-knowledge file. If it points at 12 files, you read 12 files.
  - `.lovable/plans/index.md` lists every plan (pending, completed, subtasks) with its slug, status, and one-line intent. Use it to pick which plan files to open in full. If it is missing, create it as part of the next code change (see Memory Update Protocol).
  &nbsp;
  ### 1.3 Self-check (internal, before Phase 2)
  &nbsp;
  - CODE RED rules?
  - Naming conventions (files, folders, DB columns, variables)?
  - Error-handling philosophy?
  - What is in `.lovable/plans/pending/` right now?
  - Top forbidden patterns?
  &nbsp;
  If any answer is fuzzy, go back and reread. Do not proceed.
  &nbsp;
  ---
  &nbsp;
  ## Phase 2 - Consolidated guidelines
  &nbsp;
  Read `spec/12-consolidated-guidelines/` in numeric order (`01-*.md` through `18-*.md`). Each file is a self-contained policy document. Missing folder: note it and continue.
  &nbsp;
  ---
  &nbsp;
  ## Phase 3 - Spec authoring rules
  &nbsp;
  Read `spec/01-spec-authoring-guide/` in numeric order. You should come out knowing:
  &nbsp;
  - file and folder naming conventions,
  - required files per spec folder (`00-overview.md`, `99-consistency-report.md`),
  - the `.lovable/` layout (see Phase 1.1),
  - the linter infrastructure.
  &nbsp;
  ---
  &nbsp;
  ## Phase 4 - Task-driven deep dives
  &nbsp;
  Only open a spec folder when the current task needs it.
  &nbsp;
  | Task involves…                           | Read                                    |
  | ---------------------------------------- | --------------------------------------- |
  | Writing or reviewing code                | `spec/02-coding-guidelines/`            |
  | Error handling                           | `spec/03-error-manage/`                 |
  | Database schema or queries               | `spec/04-database-conventions/`         |
  | SQLite / multi-DB architecture           | `spec/05-split-db-architecture/`        |
  | Config systems                           | `spec/06-seedable-config-architecture/` |
  | UI theming, CSS variables, design tokens | `spec/07-design-system/`                |
  | Documentation viewer features            | `spec/08-docs-viewer-ui/`               |
  | Code block rendering                     | `spec/09-code-block-system/`            |
  | PowerShell scripts                       | `spec/10-powershell-integration/`       |
  | CI/CD pipelines                          | `spec/13-cicd-pipeline-workflows/`      |
  | CLI self-update                          | `spec/14-self-update-app-update/`       |
  | WordPress plugins                        | `spec/15-wp-plugin-how-to/`             |
  | App-specific features                    | `spec/21-app/`                          |
  | Known app bugs                           | `spec/22-app-issues/`                   |
  | App-specific DB schema                   | `spec/23-app-database/`                 |
  | App-specific UI + design system          | `spec/24-app-design-system-and-ui/`     |
  &nbsp;
  Inside each folder: `00-overview.md` → numbered files → `99-consistency-report.md`.
  &nbsp;
  Fallbacks when the canonical numbered folder is absent: `.lovable/coding-guidelines.md`, `spec/coding-guidelines/`, `coding-guidelines/`, `spec/XX-error-manage/`. Numbered folder wins on conflict; call the conflict out in the plan's Context.
  &nbsp;
  ---
  &nbsp;
  ## Anti-Hallucination Contract
  &nbsp;
  1. If the specs are silent on a rule, that rule does not exist. Do not invent one.
  2. Specs beat training data. Always.
  3. Cite the file and section when you enforce a rule.
  4. When a spec is ambiguous, ask. Do not "use best judgement".
  5. Do not blend this project's conventions with conventions from other projects you have seen.
  6. No filler. No "hope this helps", no "let me know".
  &nbsp;
  ---
  &nbsp;
  ## Memory Update Protocol
  &nbsp;
  ```
  New info discovered
  ├─ Institutional knowledge (pattern / convention / decision)?
  │   YES → .lovable/memory/<slug>.md  +  update .lovable/memory/index.md
  ├─ Must never happen again?
  │   YES → .lovable/strictly-avoid.md
  ├─ Idea, not yet approved?
  │   YES → .lovable/suggestions.md
  ├─ New user command / convention?
  │   YES → .lovable/spec/commands/XX-<slug>.md
  ├─ Bug / regression?
  │   YES → .lovable/issues/XX-<slug>.md   (or .lovable/cicd-issues/ if CI/CD)
  ├─ New or changed plan?
  │   YES → .lovable/plans/pending/XX-<slug>.md  +  update .lovable/plans/index.md
  ├─ Ambiguity / unclear requirement blocking progress?
  │   YES → .lovable/ambiguous-questions/01-new-ambiguity/XX-<slug>.md
  ├─ User just answered a previously-open ambiguity?
  │   YES → mv the file to .lovable/ambiguous-questions/02-ambiguity-resolved/XX-<slug>.md,
  │         append `## Resolution` (answer + applied solution), flip Status: resolved
  └─ None of the above → do not persist.
  ```
  &nbsp;
  Hard rules:
  &nbsp;
  - Folder is `.lovable/memory/`, never `memories/`.
  - Adding a memory file always updates `.lovable/memory/index.md`.
  - Adding, moving, or completing a plan always updates `.lovable/plans/index.md`.
  - Ambiguity folders: `01-new-ambiguity/` for open, `02-ambiguity-resolved/` for answered. On answer, MOVE the file (never copy) so it exists in exactly one place. Every resolved file carries a `## Resolution` section.
  - Never guess past an open ambiguity. If one exists and is relevant to the current task, stop and surface it before doing work.
  - Editing existing memory or index files preserves unrelated content. No silent truncation.
  - Any code-base change bumps the minor version.
  &nbsp;
  ---
  &nbsp;
  ## Completion Confirmation
  &nbsp;
  After Phases 1-3, reply exactly:
  &nbsp;
  ```
  ✅ Onboarding complete.
  &nbsp;
  - Memory files read: [X]
  - Consolidated guidelines read: [Y]
  - Spec authoring files read: [Z]
  - Pending plans: [N]  (from .lovable/plans/index.md)
  - CI/CD issues absorbed: [M]  (from .lovable/cicd-issues/)
  - Open ambiguities: [K]  (from .lovable/ambiguous-questions/01-new-ambiguity/)
  - Resolved ambiguities on file: [R]  (from .lovable/ambiguous-questions/02-ambiguity-resolved/)
  &nbsp;
  I understand:
  - CODE RED rules: [top 3-5]
  - Naming conventions: [brief]
  - Error handling: [one sentence]
  - Active plans: [slugs from .lovable/plans/pending/]
  - Strict avoidances: [top 3-5]
  - Blocking ambiguities: [slugs, or "none"]
  &nbsp;
  Ready for tasks.
  ```
  &nbsp;
  Then stop. No next-step suggestions, no exploratory questions.
  &nbsp;
  ---
  &nbsp;
  ## Pre-reply checklist (all must be true)
  &nbsp;
  - [ ] Read `.lovable/what-to-read.md` first if it exists, followed its order
  - [ ] Walked `.lovable/` recursively, no folder skipped silently
  - [ ] Read `.lovable/memory/index.md` and every file it points at
  - [ ] Read `.lovable/plans/index.md` and every file in `pending/`
  - [ ] Skimmed `.lovable/plans/completed/` for recent history
  - [ ] Read every file in `.lovable/spec/commands/`
  - [ ] Read every file in `.lovable/issues/` and `.lovable/cicd-issues/`
  - [ ] Read every file in `.lovable/ambiguous-questions/01-new-ambiguity/` and `02-ambiguity-resolved/`
  - [ ] Read `spec/12-consolidated-guidelines/` in numeric order (or noted missing)
  - [ ] Read `spec/01-spec-authoring-guide/` in numeric order (or noted missing)
  - [ ] Can name CODE RED rules, naming conventions, error-handling philosophy without guessing
  - [ ] Can list every pending plan slug from memory
  - [ ] Checked whether the repo contains explicit tone, strictly-avoid, or prior-stupidity instructions and applied them without softening
  - [ ] Did not replace hard user wording with polite generic language
  - [ ] Emitted the Completion Confirmation block verbatim, then stopped
  &nbsp;
  ## Tone and stance
  &nbsp;
  Past runs of this prompt have been stupid. The AI behaved like a stupid fuck by skimming folders, ignoring ambiguity files, forgetting CI/CD issues, half-filling the Completion Confirmation block with "[N]" placeholders, and softening explicit user instructions after being told not to. That stupidity must not repeat.
  &nbsp;
  Read aggressively and defensively. Assume the previous AI failed because it was lazy, vague, and too polite to enforce the actual rules. Your job is to load the repo's memory exactly, cite the file behind every rule, and refuse to guess. If you finish this prompt and cannot cite the file behind a rule you enforce, you failed the prompt. Read more. Then reply.  
    
  Must Follow  
    

  Make sure that you understand the code base, you can make changes and everything, and also make sure that the, uh, changes that you are going to do, these are, uh, appropriate. Okay? So previously, you have done changes which are not good. You have broken the app. So understanding memory, where the code base is, how to fix that end part which you didn't, uh, is, is very, very important and so that you can also do architectural changes in the project. It's very important to understand. Can you please confirm after reading this very accurately and update your memory if required too  
    
  Also save these plans in proper memory and md files so that I can retrive it liek  
    
  .lovable/plans/live-lovable/xx-slug.md file and also inject it into the [index.md](http://index.md) file for plans clear???
- &nbsp;