# Action download resolution failures (Service Unavailable) - hardening

## Status
Mitigated (2026-08-06)

## Signal
`Prepare all required actions` -> `Failed to resolve action download info. Error: Service Unavailable / Bad Gateway / Internal Server Error`.
The job dies before any of our code runs.

## Root cause
Every `uses:` entry forces the runner to call GitHub's action-resolution API before the job starts.
When that API degrades, the job fails no matter how correct our code is.
Our workflows had 30 `uses:` references to third-party setup actions (`pnpm/action-setup`, `oven-sh/setup-bun`)
that provided nothing the runner image cannot do natively, so they added pure outage surface.

## Fix
- Replaced all `pnpm/action-setup@v4` steps in `ci.yml` and `release.yml` with `corepack enable && corepack prepare pnpm@9 --activate`.
- Replaced `oven-sh/setup-bun@v2` with the official `curl | bash` install plus a `GITHUB_PATH` append.
- Result: 30 fewer action downloads per pipeline run, so fewer chances to hit the failing resolution API.
- Fixed `scripts/clone-ahk.mjs` `CANONICAL_REPO` to `aukgit/macro-ahk-v55` (it equalled `STALE_REPO`, failing the trigger-policy test).

## Residual risk
`actions/checkout`, `actions/setup-node`, `actions/cache`, `actions/upload-artifact` are still required.
A total GitHub Actions outage still fails the run: that class is re-run only, no code fix exists.

## Prevention
Do not add a third-party action when a two-line shell step in the runner image does the same job.
