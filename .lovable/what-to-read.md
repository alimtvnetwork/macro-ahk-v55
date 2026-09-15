# What to Read

> Canonical map of what the AI must read before working on this project.
> Last updated: 2026-09-13T08:15:00Z

## Changelog

- 2026-09-13T08:15:00Z, Prompt & Memory Write Upgrade (v2.2.0): updated 01-write-antigravity.md, 03-write-memory.md, and skills to mandate 30-commit git history audit and recent 20-task tracking register in .lovable/plans/01-index.md.
- 2026-09-13T07:45:00Z, Memory Persistence & Learned Standards: recorded institutional memory for regex centralization, generic dbengine architecture, isDefined positive convention, zero-storage GitHub Actions mandate, and pre-commit guard enforcement.
- 2026-09-13T07:00:00Z, Regex Centralization & Generic DbEngine: lazy regex engine audit, core regex harvesting from 03-aukgo/core, gitmap call-site refactoring, generic redistributable dbengine package (pkg/dbengine), and Python database code generator (35-db-struct-enum-generator.py).
- 2026-09-09T05:30:00Z, Prompt update: added mandatory inspection of last 10 git commits and what-to-read prioritization to read-memory-enhanced prompt and skill.
- 2026-09-09T05:00:00Z, Memory write: conversation log & context wrapper protocol, prompt staging, split SQLite logging, task retention, errcmd streaming, atomic file writes, and ApiManager spec.
- 2026-09-04T17:39:00Z, Memory write: parallel multi-worker CI/CD local runner, selective log filtering, streamwriter contracts, and naming standards.
- 2026-09-04T02:15:00Z, Ingested whole codebase, added write-memory and write-antigravity skills, and recorded 05-codebase-topology-and-skills-architecture.md.
- 2026-08-09T18:21:37Z, Memory write: code red refactor and strict absolute path avoidance.

## Before any task (always)

- `git log -n 30 --stat` (or `git log -n 30 --oneline`), why: inspect the last 30 commits to understand recent file changes, what code/docs were touched, directives, lessons learned, and the latest repository state before starting any task
- `.lovable/what-to-read.md`, why: authoritative prioritized reading sequence that must be read and followed before touching any files
- `version.json`, why: single source of truth for the repository version, backend/frontend sections, and sub-package version tracks. All codebases must import this file for version information.
- `.lovable/memory/01-index.md`, why: core memory index
- `.lovable/memory/learned/01-project-context-and-guidelines.md`, why: canonical learned memory of repo identity, CODE RED rules, coding guidelines, error philosophy, and active plans
- `.lovable/memory/learned/03-parallel-cicd-runner-and-log-filtering.md`, why: parallel local runner concurrency, duration tracking, and log suppression standard
- `.lovable/memory/learned/04-streamwriter-contracts-and-naming-standards.md`, why: streamwriter contracts, reentrant locker, monadic Bytes[T], JsonResult multi-source ingestion, boolean prefixes, and Id naming standard
- `.lovable/memory/learned/05-codebase-topology-and-skills-architecture.md`, why: comprehensive topology ingestion, 28 AI Python scripts catalog, Antigravity skills inventory, and CI/CD quality gate enforcement
- `.lovable/memory/learned/07-split-sqlite-logging-and-task-db-migration.md`, why: split SQLite logging architecture and task DB migration contracts
- `.lovable/memory/learned/08-task-retention-streaming-atomic-apimanager.md`, why: task retention, live line streaming, atomic file writes, and ApiManager spec
- `.lovable/memory/learned/09-conversation-log-and-context-wrapper-protocol.md`, why: conversation log persistence protocol and prompt staging boundary
- `.lovable/memory/learned/13-regex-centralization-dbengine-and-isdefined-standard.md`, why: canonical regex harvesting from 03-aukgo/core, redistributable dbengine package, isDefined standard, and zero-storage GitHub Actions mandate
- `.lovable/memory/learned/14-write-prompts-git-audit-and-recent-tasks-register.md`, why: mandatory 30-commit git history audit before memory authoring, compact 20-task recent completion register in plans index, and standardized 19-box verification checklist
- `.lovable/memory/standards/version-source-of-truth.md`, why: mandatory standard for version.json single source of truth, 'inherit' keyword for sub-packages, and release sync workflow
- `.lovable/memory/01-index.md`, why: architectural map of version propagation, sync pipeline, and release ceremony
- `.lovable/coding-guidelines.md`, why: baseline rules and coding standards
- `.lovable/plans/01-index.md`, why: active roadmap, pending tasks, and recent completed tasks register (last 20 completed tasks/plans)
- `.lovable/strictly-avoid.md`, why: hard constraints and anti-patterns
- `.lovable/question-and-ambiguity/01-new-ambiguity/`, why: open questions
- `03-ai-scripts/01-index.md`, why: inventory and usage guidelines for automation tools and local CI runners

## Before writing code

- `02-spec/`, why: understand feature specifications

## Before adding a feature

- `02-spec/`, why: ensure it fits within existing specs

## Before writing a spec

- `02-spec/01-spec-authoring-guide/`, why: follow authoring format

## Before adding a unit test

- `02-spec/02-coding-guidelines/`, why: testing conventions

## See also

- Root `readme.md` (must stay in sync with this file)
- .lovable/plans/01-index.md
- .lovable/plans/pending/02-slides-system-overhaul.md
- .lovable/plans/pending/04-guideline-prompt-and-installer-upgrade.md
- .lovable/plans/pending/09-update-prompts-and-release.md
- .lovable/plans/pending/11-code-red-refactor-remediation.md
- .lovable/plans/completed/01-repository-infrastructure-cicd-and-consolidation.md
- .lovable/plans/completed/02-appfault-result-monad-and-verification-systems.md
- .lovable/plans/completed/03-fileutil-pathinfo-and-enum-architecture.md
- .lovable/plans/completed/04-applogger-taxonomy-streaming-and-task-db.md
- .lovable/plans/completed/12-regex-centralization-and-generic-dbengine.md
