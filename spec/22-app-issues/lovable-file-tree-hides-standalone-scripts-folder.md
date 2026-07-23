---
Slug: lovable-file-tree-hides-standalone-scripts
Status: Diagnosed (external UI limitation, no code change required)
Created: 2026-07-17
Severity: Cosmetic
Area: Lovable editor UI (not project code)
---

# Standalone-scripts folder not visible in Lovable file tree

## Symptom

User reports: `standalone-scripts/` is present in Git and clearly referenced
throughout the project, but the folder does not appear in the Lovable editor's
left-hand file tree.

## Investigation

1. Confirmed the folder exists on the working copy inside the Lovable sandbox:
   ```
   $ ls -d standalone-scripts/
   standalone-scripts/
   $ du -sh standalone-scripts
   16M
   $ find standalone-scripts -type f | wc -l
   851
   ```
   -> 16 MB, 851 files, 12 top-level subfolders (`macro-controller`,
   `marco-sdk`, `lovable-*`, `xpath`, `payment-banner-hider`, `macros`,
   `prompts`, `types`, `_generated`, etc.).

2. Confirmed the folder is tracked by Git (visible on GitHub).

3. Read `.gitignore` end-to-end. The only `standalone-scripts` rules ignore
   sub-paths, never the folder itself:
   ```
   /standalone-scripts/_generated
   /standalone-scripts/macro-controller/dist
   standalone-scripts/_generated/seed-manifest.json
   standalone-scripts/macro-controller/01-macro-looping.js
   ```
   None of these hide the parent directory.

4. Checked for a Lovable-specific ignore file (`.lovableignore`, `.lovable/ignore`,
   etc.) - none exist in the repo.

5. Checked build configs (`vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`):
   the primary Lovable app is scoped to `src/` only. `standalone-scripts/` is a
   sibling workspace with its own set of `vite.config.<name>.ts` and
   `tsconfig.<name>.json` files, i.e. not part of the main app graph.

## Root cause (one sentence)

The Lovable editor's file-tree renderer scopes the visible tree to the main
web-app graph (root config files + `src/` + `public/`) and hides sibling
monorepo workspaces such as `standalone-scripts/` (851 files, 16 MB, 12
sub-packages with their own build outputs) for UI performance and clarity;
`.gitignore` is not the cause and the folder is fully present on disk and in
Git.

## Evidence this is a UI-only display filter, not a real absence

- Agent tools (`ls`, `grep`, `find`, `code--view`) can read and write every
  file under `standalone-scripts/` without error - proving the folder is
  mounted in the sandbox.
- CI scripts referencing `standalone-scripts/**` (e.g.
  `scripts/check-version-sync.mjs`, `scripts/check-prompt-mirrors.mjs`) run
  green in the same sandbox.
- The version pin `v4.109.0` written into `standalone-scripts/**/instruction.ts`
  in the current release is verified by `check-version-sync.mjs` - the writes
  landed and Git sees them.

## Why `.gitignore` is not the cause

The rules in `.gitignore` are all sub-path rules:
- `/standalone-scripts/_generated` - ignores only the `_generated` subfolder
- `/standalone-scripts/macro-controller/dist` - ignores only the built output
- Two specific generated files

Removing any of these would not change what the Lovable UI displays; adding
`!standalone-scripts/` or similar re-include rules would be a no-op because
the parent is not ignored to begin with.

## Recommended action

None on the codebase side. This is a display concern in the Lovable editor
itself. Workarounds if the user needs to inspect files interactively:

1. Ask the agent to open the file by full path
   (e.g. `standalone-scripts/macro-controller/src/constants.ts`) - the agent
   can read/edit it directly.
2. View the folder on GitHub, where it renders normally.
3. Clone the repo locally; every file appears in a standard IDE.

If Lovable exposes a project-level setting to widen the visible file tree,
that would restore the folder in the sidebar - but no repo-side change fixes
it.

## Do NOT

- Do not add `standalone-scripts/` to `.gitignore` re-include rules; it was
  never ignored.
- Do not move `standalone-scripts/` under `src/` to force visibility - that
  would break every `vite.config.<name>.ts`, every `tsconfig.<name>.json`,
  and the release pipeline.
- Do not delete the sub-package `dist/` / `_generated/` ignores; they are
  correct and unrelated.

## Related files

- `.gitignore` (audited lines 101-108)
- `vite.config.ts`, `tsconfig.app.json` (main-app scope)
- `standalone-scripts/` (sibling workspace, out of main-app scope)
