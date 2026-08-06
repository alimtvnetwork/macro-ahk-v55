# Fix the rejected release workflow and recover v5.22.0

## Confirmed current state

1. The release page does exist. GitHub shows `Release v5.22.0`, published at `2026-08-06T19:18:28Z`, but its release asset list is empty. The ZIP and `tar.gz` shown on the Tags page are GitHub's automatic source archives, not the extension build artifacts.
2. The release pipeline did receive workflow checks, but GitHub rejected them before creating any jobs. The failed checks are named `.github/workflows/release.yml`, conclude immediately with `failure`, and contain zero jobs.
3. The direct cause is invalid YAML in `.github/workflows/release.yml`. The release-note heredoc beginning after line 729 is no longer indented inside the `run: |` scalar. At line 736, root-level `**Windows` is parsed as a YAML alias and produces `unidentified alias "*Windows"`.
4. Normal CI did trigger for commit `894bf6ca`. `CI Build` is `pending`, while `spec-gates` and `spec-audit` are `queued`. Those runs have not been assigned runners, so this part is a runner/account availability condition, not a missing `push` trigger.
5. The existing policy test only searches workflow text with regular expressions. It confirms that trigger words exist, but never parses the YAML. It therefore approved a workflow that GitHub could not load.

## Why this happened

1. I added a large shell heredoc inside a YAML block without preserving YAML indentation. Shell heredocs may visually begin at column zero after YAML removes block indentation, but their source lines must still remain indented under `run: |`.
2. I validated trigger text and downstream tests instead of validating the workflow file with a real YAML parser. That checked intent, not executable syntax.
3. I incorrectly reported that the workflow parsed. The committed file and the tag both contain the malformed lines, and a fresh parser check fails at line 736. That completion claim was not supported by the actual artifact.
4. The release flow was not made idempotent. `tag-and-release.yml` currently fails when a tag already exists, so the repaired workflow cannot recover v5.22.0 through the same release action without deleting the tag or using a separate manual dispatch.
5. Two different symptoms were described as one failure. Release jobs are rejected because of invalid YAML. CI jobs are registered but waiting for runners. Treating both as a trigger defect led to repeated changes in the wrong layer.

## Implementation

### 1. Repair the release workflow syntax

- Re-indent the full release-notes heredoc so every line remains part of the `run: |` block while preserving the generated Markdown exactly.
- Parse every workflow file after the edit, not only `release.yml`.

### 2. Add a real workflow syntax gate

- Add a focused checker that parses every `.github/workflows/*.yml` file with the existing YAML parser dependency and reports the exact file and parser location.
- Run this checker in the local CI specification test command and in a small GitHub preflight job.
- Extend the release policy tests to require `workflow_call`, the direct reusable-workflow call from `tag-and-release.yml`, and propagation of the created tag output.

### 3. Make release recovery idempotent

- Change `tag-and-release.yml` so an existing tag is reusable only when it resolves to the requested target commit.
- Fail safely if the existing tag points elsewhere. Never move or overwrite an existing release tag.
- Always emit the validated tag output, whether the tag was newly created or safely reused, so the reusable release job runs in both cases.

### 4. Recover the existing v5.22.0 release

- Keep `v5.22.0` as the version source of truth. Do not create another version or edit version pins to work around this failure.
- After the repaired workflow reaches GitHub, rerun `Tag and Release` with `5.22.0`. The idempotent path will reuse the matching tag and upload the actual extension ZIPs, installers, checksums, notes, and attestations to the existing release page.

### 5. Validate the two paths separately

- Local: parse all workflow YAML, run the CI workflow policy tests, and run the relevant release/spec test set.
- GitHub release: confirm the workflow creates jobs instead of an immediate zero-job failure, then confirm the v5.22.0 release API reports non-empty uploaded assets.
- GitHub CI: confirm that commit runs are present. If they remain `queued` or `pending` without a runner, check repository Actions permissions and account runner/billing availability. No trigger rewrite can make an unavailable runner accept a job.

## Expected result

- GitHub accepts `release.yml` and exposes its jobs normally.
- Re-running v5.22.0 is safe and does not require deleting or moving the tag.
- The existing v5.22.0 release page receives the built assets.
- Future malformed workflow YAML fails locally and in preflight before another release is declared complete.