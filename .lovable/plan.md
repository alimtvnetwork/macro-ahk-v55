## Problem

CI job `check-readme-hero-layout.mjs` fails: the "Backed by ... xProduct" line I added yesterday sits in a **second** `<div align="center">` at line 16, outside the hero block. Spec `11-root-readme-conventions.md` §Hard Rules allows centered `<div>` wrappers only inside the hero block or the `## Author` section. All other CI gates (`check-readme-compliance`, badges, one-H1, hero-close) pass.

Same release also needs a minor version bump so the readme change ships cleanly and 14 pinned `v5.9.0` references in `readme.md` stay consistent with `version.json`.

## Plan

### 1. Fix hero layout (unblock CI)

In `readme.md`:
- Delete the standalone `<div align="center"> ... Built and maintained by ... </div>` block currently at lines ~15-19.
- Move that single "Backed by" sentence **inside** the existing hero `<div align="center">`, placed on its own paragraph directly below the badges and immediately above the hero screenshot `<img ... marco-extension-hero.png ...>`. This keeps the "Backed by" credit visible in the hero, satisfies rule 7 (one hero div, closed before first `##`), and re-runs of `check-readme-hero-layout.mjs` return 7/7.

### 2. Version bump 5.9.0 to 5.10.0

- `version.json`: bump `version` and `date`/`releaseDate` to today (2026-07-23).
- `readme.md`: replace all 14 occurrences of `v5.9.0` with `v5.10.0` (install snippets, pinned-version callout, "Macro Controller: v5.9.0" line, download filename `marco-extension-v5.9.0.zip`).
- Root `changelog.md`: add `## v5.10.0 - 2026-07-23` entry noting (a) hero-layout fix, moved "Backed by" credit inside hero div per spec 11 Hard Rule 7; (b) no functional changes.
- `standalone-scripts/macro-controller/changelog.md`: matching `## v5.10.0` stub entry (docs-only release, no controller code changes).

### 3. Verify all CI gates locally

Run in parallel and confirm exit 0:
- `node scripts/check-readme-hero-layout.mjs`
- `node scripts/check-readme-compliance.mjs`
- `node scripts/check-readme-txt.mjs`
- `node scripts/check-spec-readme-structure.mjs`
- `node scripts/check-no-pnpm-dlx-less-readme.md` (if executable, else skip)
- `node scripts/check-madge-cycles.mjs --strict`
- `node scripts/audit-p0-rules.mjs --strict`
- `npx eslint standalone-scripts --max-warnings=0`
- `npx tsc --noEmit -p tsconfig.macro.build.json`

If any additional check reports a regression tied to the version bump (e.g. installer-tests referencing v5.9.0 assets), patch inline and re-run.

### 4. Log follow-ups

Append/create entries under `.lovable/issues/open/` only for genuinely new pending items surfaced during verification (e.g. if any pinned-version reference lives outside readme.md and needs a broader sweep). No speculative issues.

## Technical notes

- `check-readme-hero-layout.mjs` flags disallowed centered wrappers by line number; only line 16 is offending, so a single-block edit resolves it.
- The `## Author` section already has its own permitted centered `<div>`; do not touch it.
- Version sweep scope for readme.md is limited to literal `v5.9.0` tokens (14 hits confirmed via grep). No code files reference the release string.
