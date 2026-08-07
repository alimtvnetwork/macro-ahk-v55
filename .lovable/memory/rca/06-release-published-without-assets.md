---
name: Releases published with zero assets
description: v5.9.0 through v5.22.0 published release pages with no extension or prompts zip. Three causes, and the rule that release health is verified through the Actions API, never through a file diff.
type: constraint
---
# RCA 06, releases published without assets

Date: 2026-08-07. Repo: `alimtvnetwork/macro-ahk-v55`.

## Symptom

Tags landed, release pages appeared, and every page carried only the automatic
source archives. The Chrome extension zip, the prompts bundle, the macro
controller bundle and the installers were absent. Reported repeatedly as
"CI/CD is not triggering" and "the build steps are missing from the new repo".

## Evidence pulled from the GitHub API

- Releases `v5.9.0`, `v5.10.0`, `v5.11.0`, `v5.12.1`, `v5.13.0`, `v5.14.0`, `v5.17.0`, `v5.20.0`, `v5.20.1`, `v5.21.0`, `v5.22.0`: **0 assets each**.
- Release `v5.24.0`, run `31197971381`: all seven jobs succeeded, **18 assets** published, `marco-extension-v5.24.0.zip` 2321005 bytes, `prompts-v5.24.0.zip` 111401 bytes.
- `.old-github/.github/workflows/` is a strict subset of `.github/workflows/`. The build and packaging steps were never removed.

## Root causes, three independent layers

1. **Unparseable `release.yml`.** A markdown heredoc sat at column zero inside a `run:` block scalar, so GitHub rejected the file. Runs `31124528184` through `31127144064` show `conclusion=failure` with **zero jobs**. A startup failure looks like an ordinary red run, which is why it went unread for days. Fixed in v5.23.0 by `scripts/check-workflow-yaml.mjs`.
2. **`GITHUB_TOKEN` push suppression.** A tag pushed by the built-in token emits no `push` event, so server-side tagging could never fire `push: tags: v*`. Fixed by `tag-and-release.yml` calling `release.yml` through `workflow_call`.
3. **Trigger fan-out.** `push: tags` plus a bare `create:` plus five `release:` types produced **five** Release Build runs for `v5.24.0` in three seconds. The `release-${{ github.ref }}` concurrency group kept one and cancelled three, and one was fired by the creation of the unrelated `release/v5.24.0` **branch**. Cancelled runs read as "nothing ever ran". Fixed in v5.25.0: bare `create:` removed, `release:` narrowed to `published`.

## Diagnostic failure, the part to never repeat

The pipeline was declared fixed three times on the strength of a workflow-file
diff. A diff proves the YAML text, not that a run started, not that jobs
executed, and not that assets landed.

**Standing rule.** Before claiming any release or CI fix works, query all three:

```bash
curl -s "https://api.github.com/repos/<slug>/actions/runs?per_page=10"          # did it run
curl -s "https://api.github.com/repos/<slug>/actions/runs/<id>/jobs"            # did jobs execute
curl -s "https://api.github.com/repos/<slug>/releases/tags/<tag>"               # did assets land
```

A run with zero jobs is a **startup failure**, meaning the workflow file itself
was rejected. A release with zero assets is a **failed release** even when the
page exists.

## Guard added

`scripts/check-release-assets.mjs` runs as the last step of the `release` job and
fails the run when `marco-extension-<tag>.zip`, `prompts-<tag>.zip`,
`macro-controller-<tag>.zip`, the SDK or XPath bundles, either installer,
`checksums.txt` or `VERSION.txt` is missing or under its size floor.