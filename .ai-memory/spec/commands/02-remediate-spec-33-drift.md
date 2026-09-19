Slug: remediate-spec-33-drift
Status: active
Created: 2026-07-17

# Remediate standalone-scripts guideline drift (spec/33)

Command captured: 2026-07-17
Source turn: user asked to read `spec/33-missing-coding-guideline/` and execute the fixes across a 30-step plan.

## Verbatim

> Now that you have the improvements guideline in the folder 33 inside the spec, I want you to read that folder and improve the code quality and everything else so that it feels improved. It would be much more easier to comprehend. Also, make sure that do not break any logic, and I will give you 30 steps to do that.

## Scope

Applies to every package under `standalone-scripts/**`. Ordering, targets, and CI baselines are pinned by:

- `spec/33-missing-coding-guideline/99-backlog.json` (27 items, P0/P1/P2, owner + due).
- `spec/33-missing-coding-guideline/99-baselines.json` (CI floor at v4.87.0; target column).
- `spec/33-missing-coding-guideline/14-eslint-and-tsc-rule-additions.md` (draft rules + 7 CI check scripts + 9-PR rollout).

## When it applies

Every remediation PR opened against `standalone-scripts/**` from this date forward. No behavior change permitted; each PR ships tests proving parity plus the matching CI check script from `14-*.md`.

## Non-negotiable

- Zero regressions to user-visible behavior (Plan+Next chips, macro run, credit totals, workspace ops, prompt library IO).
- Every PR pairs code change with (a) the matching ESLint / tsc / check-* rule enabling and (b) tests locking the pre-change behavior.
- Version bump + changelog + release notes + root readme pin per release.
- Follows `mem://constraints/no-retry-policy`, `mem://standards/error-logging-via-namespace-logger`, `mem://auth/unified-auth-contract`, `mem://standards/timer-and-observer-teardown`, `mem://standards/unknown-usage-policy`, `mem://preferences/test-with-features`.

## Owning plan

`.lovable/plans/pending/17-standalone-scripts-guideline-remediation.md`
