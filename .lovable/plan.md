## Root cause

`tests/e2e/prompt-export-import-roundtrip.spec.ts` seeds two entries with `isDefault: true`. After the v5.9.0 user-scope export refactor (`filterUserAddedEntries`), the exporter drops all default-flagged rows and never dispatches a download blob, so `page.waitForEvent('download')` hits the 60s timeout and the harness page closes.

## Plan

### 1. Fix the failing E2E (test-only change)

In `tests/e2e/prompt-export-import-roundtrip.spec.ts`:
- Flip both seeded entries in Stage 1 to `isDefault: false` so the user-scope filter keeps them.
- Keep the rest of the harness (mock `sendMessage`, synthesised revisions, badge assertions) intact.
- Add a short comment above the seed block noting the user-scope invariant so future edits do not regress this.

No production code changes needed. If a full green run reveals the same filter assumption in `tests/e2e/prompt-history-import-roundtrip.spec.ts`, apply the same one-line seed fix there.

### 2. Verify CI gates locally (parallel)

- `npx playwright test tests/e2e/prompt-export-import-roundtrip.spec.ts` (green)
- `npx tsc --noEmit -p tsconfig.macro.build.json`
- `npx eslint standalone-scripts --max-warnings=0`
- `node scripts/check-madge-cycles.mjs --strict`
- `node scripts/audit-p0-rules.mjs --strict`
- `node scripts/check-readme-hero-layout.mjs`
- `node scripts/check-readme-compliance.mjs`

### 3. Minor release v5.10.0 to v5.11.0

Follow `.lovable/prompts/08-bump-version.md` (full ceremony, per the last release turn's precedent):

- `version.json`: `version` to `5.11.0`, `releaseDate` and `date` to today UTC.
- Root `changelog.md`: prepend `## v5.11.0 - <today>` entry with:
  - Fixed: prompt export -> import round-trip E2E timeout caused by user-scope export filter dropping default-flagged seed entries.
- `standalone-scripts/macro-controller/changelog.md`: matching `## v5.11.0` stub (test-only release, no controller code changes).
- Root `readme.md`: replace all `v5.10.0` occurrences with `v5.11.0` (badges, install snippets, pinned-version callout, download filename).

### 4. Follow-ups logged under `.lovable/issues/open/`

- `20-e2e-user-scope-export-seed-invariant.md`: document the "seeds must use `isDefault: false` for export tests" rule so new E2Es do not regress.
- Carry forward existing open items (16 release doc conflict, 17 modal round-trip flake, 18 two parallel import UIs, 19 workspace move v2 live verify) unchanged.

### 5. Report back

- Previous and new version, bump tier (MINOR).
- Files updated: `tests/e2e/prompt-export-import-roundtrip.spec.ts`, `version.json`, root `changelog.md`, macro-controller `changelog.md`, root `readme.md`, one new issue file.
- Confirmation that all listed CI gates exit 0.

## Technical notes

- Root cause verified against `standalone-scripts/macro-controller/src/ui/prompt-io.ts` (filterUserAddedEntries) added in v5.9.0.
- No production code touched, so the release is docs + test only and safe as a minor bump.
- Release doc conflict (`how-to-release.md` says version.json-only, `08-bump-version.md` says multi-file) remains unresolved; sticking with the multi-file ceremony per the user's explicit "add changelog and pin that version" instruction. Logged separately as issue 16.
