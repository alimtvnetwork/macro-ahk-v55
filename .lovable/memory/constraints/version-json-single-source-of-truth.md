---
name: version.json is canonical version source
description: version.json is the only human-edited release version. Manifest output is generated from it and guarded after build.
type: constraint
---

# version.json is the canonical version source

## Rule

`version.json` at repo root is the only human-edited release version file. Do not hand-edit downstream version pins just to propagate a bump.

The Chrome extension manifest must derive from `version.json` automatically:

1. `scripts/sync-manifest-version.mjs` updates the source manifest during extension builds.
2. `vite.config.extension.ts` sets the built manifest `version` from root `version.json`.
3. `scripts/check-built-manifest-csp.mjs` fails after build if the built manifest version differs from `version.json`.

## Required release edits

1. Update `version.json` (`version` and `releaseDate`).
2. Do not edit `manifest.json`, constants, instruction files, readme pins, or generated prompt bundles only to propagate a version.
3. If publishing is explicitly requested, create the matching `v<version>` tag after the `version.json` change is on the target branch.
4. If a version mismatch appears, fix the generator or guard path, then rebuild and reload the extension.

## Historic allow-list

Previous versions may remain in historic release files, prompt versions, examples, fixtures, and documentation history. They must not be treated as live release pins.

## Never

- Never manually edit `manifest.json` as a release propagation step.
- Never add stale-version, release-readiness, or asset-manifest gates to force humans to sync downstream pins.
- Never fix an extension version mismatch by only copying the number. Fix the automated source path too.
- Never add release asset readiness gates or CI/CD stale-version workflows.
