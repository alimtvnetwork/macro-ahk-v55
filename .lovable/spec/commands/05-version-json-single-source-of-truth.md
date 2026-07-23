# Command: version.json is the single source of truth for version

Status: active
Created: 2026-07-20
Scope: entire repo, all packages, all scripts, all workflows

## Verbatim

"A release can be very smooth. It could be just updating the JSON version on top
of the repo and everyone should be following that. Everyone from the root of the
repo version.json. That's it. It doesn't have to change in several different
ways. If it has to change, it should be changed by CI/CD. Only change for a
version that is needed is inside that version.json. Every file, everything
should actually refer or read from this."

## Rules

1. `version.json` at repo root is the ONLY human-edited version pin.
2. Every other file that needs the version (manifest.json, package.json,
   src/shared/constants.ts, readmes, install scripts, changelog headings,
   prompts, docs) MUST read from `version.json` at
   build/runtime, or be rewritten by a CI/CD job whose input is `version.json`.
3. Humans NEVER hand-edit those downstream pins. If a downstream pin drifts, CI
   rewrites it, does not fail the build asking a human to fix it.
4. No script may require the developer to run `update-stale-version-refs.mjs`.
5. Release ceremony reduces to: edit `version.json`; create the matching `v*` tag when publishing is needed.
6. Any new file added later that embeds the version MUST read from `version.json`, not from a copied pin.
