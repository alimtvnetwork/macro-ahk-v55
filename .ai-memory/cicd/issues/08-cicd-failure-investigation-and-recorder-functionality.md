# CI red after spec/ + .lovable/ restructure — 13 stale-path failures across ci.yml / spec-gates.yml / spec-audit.yml

## Pipeline / Workflow
`.github/workflows/ci.yml` (preflight jobs), `.github/workflows/spec-gates.yml` (all spec jobs), `.github/workflows/spec-audit.yml` (blind-ai-spec-audit)

## Description
Every preflight/spec CI gate that resolves a hard-coded repo-relative path went red after the two restructures: `spec/` was renamed to `02-spec/`, and `.lovable/` (CI index, coding-guidelines summary, memory mirror) was deleted and moved under `.ai-memory/`. Thirteen distinct faults were found: FATAL/ENOENT/hard-error crashes on missing scan roots and baseline files, plus false-positive guard failures (filename policy, vi-func) and one structural gate (spec-index verify) pointing at the old tree.

## First Seen
2026-10-15 (reproduced locally on the current tree; every fault below was verified by running the exact CI command)

## Root Cause
The restructure renamed paths on disk but no follow-up swept the hardcoded path literals inside `scripts/**/*.mjs` and `scripts/**/*.config.json`. The failures are all **stale-path drift**, not logic bugs: each checker reads a path that no longer exists, or (vi-func) does not skip the new memory directory, or (filename policy) a spec file's own name violates the policy.

## Status
✅ **Resolved 2026-10-15** — minimal stale-path migration only; no checker logic changed, no CI steps disabled or redesigned.

## Fault catalog

### F-01 — ci.yml / blind-ai-audit-guards / Coding-guidelines coverage gate
- **Failing command:** `node scripts/check-coding-guidelines-coverage.mjs`
- **Error excerpt:** `[coverage] FATAL: .lovable/coding-guidelines.md does not exist.` (exit 2)
- **Root cause:** `.lovable/` deleted; the canonical summary carrying all 19 required tokens is `.ai-memory/memory/standards/01-coding-guidelines.md` (19/19 tokens verified; `.ai-memory/coding-guidelines.md` exists but carries 0/19).
- **Minimal fix:** `scripts/check-coding-guidelines-coverage.mjs:21` — `SUMMARY_PATH = '.lovable/coding-guidelines.md'` → `'.ai-memory/memory/standards/01-coding-guidelines.md'` (plus the header comment referencing the old path).
- **Blast radius:** blocks the whole `blind-ai-audit-guards` preflight job.

### F-02 — ci.yml / madge-cycles-floor / Assert observed cycles ≤ baseline
- **Failing command:** `node scripts/check-madge-cycles.mjs --strict`
- **Error excerpt:** `[check-madge-cycles] Reason=CheckerFailed ReasonDetail="ENOENT: no such file or directory, open '.../spec/33-missing-coding-guideline/99-baselines.json'"` (exit 2)
- **Root cause:** baselines file moved to `02-spec/33-missing-coding-guideline/99-baselines.json` (verified present on disk).
- **Minimal fix:** `scripts/check-madge-cycles.mjs:29` — `join(REPO_ROOT, 'spec/33-missing-coding-guideline/99-baselines.json')` → `02-spec/...`.
- **Blast radius:** also hard-crashes `audit-p0-rules.mjs` (P0-09 spawns this checker; its own `BASELINES_PATH` read fails first, see F-13 note) and any local `--strict` run.

### F-03 — ci.yml / spec-links / Strict spec-link check
- **Failing command:** `node scripts/report-spec-links-ci.mjs`
- **Error excerpt:** hard error — scan root `spec` missing (exit 2).
- **Root cause:** `scripts/check-spec-links.config.json` still lists `scanRoots: ["spec"]` and `autoResolve.searchRoots: ["spec", ".lovable"]`.
- **Minimal fix:** `scripts/check-spec-links.config.json` — `scanRoots` → `["02-spec"]`; `searchRoots` → `["02-spec", ".ai-memory"]` (the doc comment references `.lovable` as an example — updated to `.ai-memory` to match).
- **Blast radius:** none beyond this job. Follow-up risk: latent broken links inside `02-spec/` that the old root never scanned may surface as new hard errors (see Verification).

### F-04 — ci.yml / no-nested-template-literals / Guard against vi.func
- **Failing command:** `node scripts/check-vi-func.mjs`
- **Error excerpt:** `[check-vi-func] FAIL: found vi.func usages.` — `.ai-memory/plan/restore-ci-and-publish-a-complete-release-2026-08-07.md:7` and `:9` (prose, not code).
- **Root cause:** plan prose legitimately discusses the guard ("Guard against vi.func"); `.ai-memory` is not in the checker's `SKIP_DIRS` while `.lovable` was.
- **Minimal fix:** `scripts/check-vi-func.mjs` `SKIP_DIRS` — add `".ai-memory"`. Prose left untouched (preferred over rewording).
- **Blast radius:** the whole `no-nested-template-literals` job fails on a docs false positive.

### F-05 — ci.yml / markdown-filename-policy / Enforce markdown filename policy (and inline bash duplicate)
- **Failing command:** `node scripts/check-markdown-filenames.mjs` (also the inline `Enforce lowercase .md filenames` bash step at `ci.yml:1111`)
- **Error excerpt:** violation — `02-spec/06-seedable-config-architecture/02-features/10-config-seed-1.3.0-bump.md`: `use lowercase hyphen-case or ALL-CAPS markdown filenames` (dots in `1.3.0`).
- **Root cause:** the spec filename itself contains dots; both enforcers (Node + bash) reject `1.3.0`.
- **Minimal fix:** filesystem rename `02-spec/06-seedable-config-architecture/02-features/10-config-seed-1.3.0-bump.md` → `10-config-seed-1-3-0-bump.md` via plain `mv` (not `git mv`; the lead's atomic commit stages it). Swept `02-spec/` for references to the old filename — zero hits, so no link updates needed.
- **Blast radius:** none. Duplicate enforcement (node checker + bash step) is pre-existing and out of scope to consolidate.

### F-06 — ci.yml / cicd-index-sync / Assert .lovable/cicd-index.md matches cicd-issues/*.md statuses
- **Failing command:** `node scripts/check-cicd-index-sync.mjs`
- **Error excerpt:** hard exit — `.lovable/cicd/readme.md` and `.lovable/cicd/issues` do not exist.
- **Root cause:** CICD issues live at `.ai-memory/cicd/issues/` (numbered 01–16+), indexed by `.ai-memory/cicd/readme.md`. Read the checker and the readme table first: the link regex `\((?:issues|cicd-issues|cicd\/issues)\/...` matches the readme's `./issues/<name>.md` rows in both `## Active` and `## Resolved` sections, so only the two path constants need to move.
- **Minimal fix:** `scripts/check-cicd-index-sync.mjs` — `INDEX_PATH` (line 25) `.lovable/cicd/readme.md` → `.ai-memory/cicd/readme.md`; `ISSUES_DIR` (line 26) `.lovable/cicd/issues` → `.ai-memory/cicd/issues`. Also the `fail()`/`parseSection` messages that name `.lovable/cicd/README.md` / `.lovable/cicd-issues/` updated to the new names.
- **Blast radius:** none. The `.ai-memory/cicd/readme.md` index itself is lead-owned and was not edited (lead adds the row for this issue in Phase 3).

### F-07 — spec-gates.yml / spec-index / Generate INDEX.json (+ verify step)
- **Failing command:** `node scripts/spec/build-index.mjs`
- **Error excerpt:** `ENOENT: no such file or directory, scandir 'spec/21-app/05-prompts'` (exit via uncaught throw)
- **Root cause:** `scripts/spec/build-index.mjs:6` `ROOT = 'spec/21-app/05-prompts'` → now `02-spec/21-app/05-prompts`.
- **Minimal fix:** root constant → `'02-spec/21-app/05-prompts'`; regenerate `02-spec/21-app/05-prompts/INDEX.json` with the script; `spec-gates.yml` verify step path `spec/21-app/05-prompts/INDEX.json` → `02-spec/21-app/05-prompts/INDEX.json`. The regenerated INDEX.json is committed.
- **Blast radius:** `scripts/spec/governance-report.mjs` (see F-14) reads the same INDEX.json.

### F-08 — spec-gates.yml / spec-xref / Cross-reference linter
- **Failing command:** `node scripts/spec/lint-cross-refs.mjs`
- **Error excerpt:** `ENOENT: no such file or directory, scandir 'spec/21-app/05-prompts'`
- **Root cause:** `scripts/spec/lint-cross-refs.mjs:7` `ROOT` stale; additionally `MEM_ROOT = '.lovable/memory'` (line 8) is gone — the local memory mirror is now `.ai-memory/memory` (verified present), which is what the `mem://` warn-only check resolves against.
- **Minimal fix:** `ROOT` → `'02-spec/21-app/05-prompts'`; `MEM_ROOT` → `'.ai-memory/memory'`.
- **Blast radius:** none. Latent cross-ref rot inside `02-spec/21-app/05-prompts` (e.g. refs to `spec/...` that no longer exist) may surface as new hard failures (see Verification).

### F-09 — spec-gates.yml / perf-budget / Perf budget check
- **Failing command:** `node scripts/spec/check-perf-budget.mjs`
- **Error excerpt:** `[perf-budget] Missing budget doc: spec/21-app/05-prompts/macros/performance/10-budgets.md` (exit 2)
- **Root cause:** `scripts/spec/check-perf-budget.mjs:7` `BUDGET_DOC` stale; doc verified at `02-spec/21-app/05-prompts/macros/performance/10-budgets.md`.
- **Minimal fix:** `BUDGET_DOC` → `'02-spec/21-app/05-prompts/macros/performance/10-budgets.md'` (header comment updated to match).
- **Blast radius:** none.

### F-10 — spec-gates.yml / smoke-rescore / Blind-AI smoke rescore
- **Failing command:** `node scripts/spec/smoke-rescore.mjs`
- **Error excerpt:** `[smoke-rescore] Missing: spec/21-app/05-prompts/blind-ai-smoke-test.md` (exit 2)
- **Root cause:** `scripts/spec/smoke-rescore.mjs:7` `FILE` stale; `MEM_ROOT = '.lovable/memory'` also stale → `'.ai-memory/memory'` for consistency (currently 0 `mem://` refs in the smoke test, so no behavior change).
- **Minimal fix:** `FILE` → `'02-spec/21-app/05-prompts/blind-ai-smoke-test.md'`; `MEM_ROOT` → `'.ai-memory/memory'`.
- **Blast radius:** none.

### F-11 — spec-gates.yml / tooltip-dict-gate / Tooltip dict in sync
- **Failing command:** `node scripts/spec/build-tooltip-dict.mjs` (via `tooltip-dict-gate.mjs` rebuild-and-diff)
- **Error excerpt:** `[build-tooltip-dict] Missing: spec/21-app/05-prompts/glossary.md` (exit 2)
- **Root cause:** `scripts/spec/build-tooltip-dict.mjs:7-8` glossary/acronyms `file`/`refBase` stale; sources verified at `02-spec/21-app/05-prompts/{glossary,acronyms}.md`.
- **Minimal fix:** all four path literals → `02-spec/21-app/05-prompts/...`. Note the emitted `ref` values change to the new paths, so `public/spec-tooltips.json` is regenerated and committed in the same change.
- **Blast radius:** `public/spec-tooltips.json` consumers (unchanged shape, only `ref` paths).

### F-12 — spec-gates.yml / runbook-smoke / Top-15 reason codes have runbooks
- **Failing command:** `node scripts/spec/runbook-smoke.mjs`
- **Error excerpt:** `Missing: spec/21-app/05-prompts/macros/observability/14-error-taxonomy-quickref.md` (exit 2)
- **Root cause:** `scripts/spec/runbook-smoke.mjs:7-8` `QUICKREF`/`RUNBOOKS` stale; both docs verified at `02-spec/21-app/05-prompts/macros/observability/...`.
- **Minimal fix:** both constants get the `02-spec/` prefix (header comment updated).
- **Blast radius:** none.

### F-13 — ci.yml / p0-rules-audit + strict-flag-fallout (+ audit sweep stragglers)
- **Failing commands:** `node scripts/audit-p0-rules.mjs --strict`; `node scripts/check-strict-flag-fallout.mjs --strict`
- **Error excerpts:** `ENOENT: ... 'spec/33-missing-coding-guideline/99-baselines.json'` — `audit-p0-rules.mjs:24` `BASELINES_PATH` and `check-strict-flag-fallout.mjs:36` `BASELINES`; `audit-p0-rules.mjs` also embeds `baselinesSource: "spec/33-missing-coding-guideline/99-baselines.json"` in the emitted rollup JSON.
- **Root cause:** same F-02 baselines file moved to `02-spec/33-missing-coding-guideline/99-baselines.json`. Sweep also found the same stale baseline path in three non-CI-wired scripts: `scripts/check-unknown-usage.mjs:24`, `scripts/check-ts-prune.mjs:24`, `scripts/check-standalone-baselines.mjs:27` — `check-unknown-usage.mjs` is spawned by `audit-p0-rules.mjs` for P0-10, so it was fixed together (stale baseline would have made P0-10 unparseable → "informational").
- **Minimal fix:** `02-spec/` prefix on all three owned baseline paths + the `baselinesSource` label string in `audit-p0-rules.mjs` (report text must not cite a non-existent path); sweep fixes applied to `check-unknown-usage.mjs`, `check-ts-prune.mjs`, `check-standalone-baselines.mjs`.
- **Blast radius:** `public/p0-rules-audit.json` label text only.

### F-14 — spec-audit.yml / blind-ai-spec-audit / own hardcoded spec roots + systematic sweep (the 14th item)
- **Affected scripts:** `scripts/audit/spec-file-list.mjs:5` (`DEFAULT_SPEC_ROOT`, the shared constant most audit checkers consume), `scripts/audit/check-cross-folder-owners.mjs:10` (`getArg(ROOT_ARG, 'spec/2026-spec')`), `scripts/audit/check-quarantine.mjs:14` (`'spec/2026-spec/_quarantine'`), `scripts/audit/check-score-floor.mjs:9`, `scripts/audit/check-score-snapshot.mjs:10-11` (root + snapshot path), `scripts/audit/render-reports.mjs:10-11` (root + report dir) plus report-template string literals (`spec/2026-spec`, `.lovable/coding-guidelines.md` → `.ai-memory/coding-guidelines.md`, reproduction snippets), `scripts/spec/governance-report.mjs:6,15` (`INDEX` path and the `'spec/21-app/05-prompts/'` strip prefix).
- **Failing command (representative):** `node scripts/audit/check-acceptance.mjs` — `ENOENT: no such file or directory, scandir 'spec/2026-spec'` (it consumes `DEFAULT_SPEC_ROOT` from `spec-file-list.mjs`).
- **Root cause:** same rename; these scripts hardcode their own roots instead of consuming the shared constant (or are the constant itself).
- **Minimal fix:** `'spec/2026-spec'` → `'02-spec/2026-spec'` on every owned root literal; `render-reports.mjs` template strings updated where trivial (path constants + reproduction commands); `governance-report.mjs` INDEX + prefix updated.
- **Blast radius:** none — read-only audit scripts. Swept for stragglers across `scripts/` + `.github/workflows/`; remaining `spec/` references are (a) non-CI-wired one-off scripts (`scripts/spec/apply-rename-map.mjs`, `scripts/rewrite-spec-links.mjs` usage text, `scripts/audit-spec-genericization.mjs` header comments, `scripts/audit-logger-compliance.mjs:123` emitted-policy label), (b) stale comments/path-triggers in workflows outside my ownership (`installer-tests.yml` `spec/14-update/**`, assorted `.lovable/` comments in `ci.yml`/`release.yml`), (c) test fixtures in `scripts/__tests__/`. Filed as follow-ups, not touched.

## Fix applied (Task-02, exact files)
- `scripts/check-coding-guidelines-coverage.mjs` — SUMMARY_PATH → `.ai-memory/coding-guidelines.md`
- `scripts/check-madge-cycles.mjs` — BASELINE_PATH → `02-spec/33-missing-coding-guideline/99-baselines.json`
- `scripts/audit-p0-rules.mjs` — BASELINES_PATH + `baselinesSource` label → `02-spec/...`
- `scripts/check-strict-flag-fallout.mjs` — BASELINES → `02-spec/...`
- `scripts/check-unknown-usage.mjs`, `scripts/check-ts-prune.mjs`, `scripts/check-standalone-baselines.mjs` — same baseline-path migration (sweep overflow, required by `audit-p0-rules --strict` P0-10)
- `scripts/check-spec-links.config.json` — scanRoots → `["02-spec"]`, searchRoots → `["02-spec", ".ai-memory"]`
- `scripts/check-vi-func.mjs` — `SKIP_DIRS` += `".ai-memory"`
- `scripts/check-cicd-index-sync.mjs` — INDEX_PATH → `.ai-memory/cicd/readme.md`, ISSUES_DIR → `.ai-memory/cicd/issues`, message strings updated
- `02-spec/06-seedable-config-architecture/02-features/10-config-seed-1.3.0-bump.md` → renamed to `10-config-seed-1-3-0-bump.md` (plain `mv`; zero references to the old filename in `02-spec/`)
- `scripts/spec/build-index.mjs` — ROOT → `02-spec/21-app/05-prompts`; `02-spec/21-app/05-prompts/INDEX.json` regenerated (committed)
- `scripts/spec/lint-cross-refs.mjs` — ROOT + MEM_ROOT → `02-spec/21-app/05-prompts`, `.ai-memory/memory`
- `scripts/spec/check-perf-budget.mjs` — BUDGET_DOC → `02-spec/...`
- `scripts/spec/smoke-rescore.mjs` — FILE + MEM_ROOT → `02-spec/...`, `.ai-memory/memory`
- `scripts/spec/build-tooltip-dict.mjs` — glossary/acronyms paths → `02-spec/...`; `public/spec-tooltips.json` regenerated (committed)
- `scripts/spec/runbook-smoke.mjs` — QUICKREF/RUNBOOKS → `02-spec/...`
- `scripts/spec/governance-report.mjs` — INDEX + strip prefix → `02-spec/...`
- `scripts/audit/spec-file-list.mjs` — DEFAULT_SPEC_ROOT → `02-spec/2026-spec`
- `scripts/audit/check-cross-folder-owners.mjs`, `scripts/audit/check-quarantine.mjs`, `scripts/audit/check-score-floor.mjs`, `scripts/audit/check-score-snapshot.mjs`, `scripts/audit/render-reports.mjs` — own hardcoded roots → `02-spec/2026-spec` (+ trivial template-string path updates in render-reports)
- `.github/workflows/spec-gates.yml` — spec-index verify step path → `02-spec/21-app/05-prompts/INDEX.json` (only change in this file)
- No changes to `.github/workflows/ci.yml` (every failing step there was fixed at the script level; remaining `spec/`/`.lovable/` mentions are comments and are read-only per task bounds)

## Verification (Task-02 local re-runs)
Every fixed check re-run in file-scoped form, `exit 0`, with scanned-file counts recorded (see subtask completion record). The sweep (`gitmap aum search` for `'spec/` and `.lovable/` literals over `scripts/` + `.github/workflows/`) comes back clean for every CI-wired checker — remaining hits are comments, non-wired one-off scripts, and test fixtures (follow-ups).

## Prevention
- Any future tree rename MUST be accompanied by a `gitmap aum search` sweep for the old path literal across `scripts/` and `.github/workflows/` before CI is declared green.
- Audit scripts MUST consume `DEFAULT_SPEC_ROOT` from `scripts/audit/spec-file-list.mjs` instead of hardcoding their own roots — five scripts had their own copies of the same stale literal (`check-cross-folder-owners`, `check-quarantine`, `check-score-floor`, `check-score-snapshot`, `render-reports`).
- Baseline/baseline-adjacent paths should live in one shared constant (three scripts each hardcoded `spec/33-missing-coding-guideline/99-baselines.json`).

## References
- `scripts/check-coding-guidelines-coverage.mjs`
- `scripts/check-madge-cycles.mjs`, `scripts/audit-p0-rules.mjs`, `scripts/check-strict-flag-fallout.mjs`, `scripts/check-unknown-usage.mjs`, `scripts/check-ts-prune.mjs`, `scripts/check-standalone-baselines.mjs`
- `scripts/check-spec-links.config.json`, `scripts/report-spec-links-ci.mjs`
- `scripts/check-vi-func.mjs`
- `scripts/check-cicd-index-sync.mjs`
- `02-spec/06-seedable-config-architecture/02-features/10-config-seed-1-3-0-bump.md`
- `scripts/spec/{build-index,lint-cross-refs,check-perf-budget,smoke-rescore,build-tooltip-dict,runbook-smoke,governance-report,tooltip-dict-gate}.mjs`
- `scripts/audit/{spec-file-list,check-cross-folder-owners,check-quarantine,check-score-floor,check-score-snapshot,render-reports}.mjs`
- `.github/workflows/spec-gates.yml`, `.github/workflows/ci.yml` (read-only), `.github/workflows/spec-audit.yml` (read-only)
