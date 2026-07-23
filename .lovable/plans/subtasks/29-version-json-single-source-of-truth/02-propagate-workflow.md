# SS-02: version-propagate.yml workflow

Parent: 29-version-json-single-source-of-truth
Slug: propagate-workflow
Status: pending
Created: 2026-07-20

## Goal

Create the ONE workflow that rewrites every downstream version pin whenever
`version.json` changes. No human ever runs the propagator locally.

## Trigger

```yaml
on:
  push:
    paths:
      - version.json
```

(No branch filter, per `mem://constraints/ci-push-trigger-unfiltered` — the
`paths` filter is acceptable here because the workflow is scoped to a single
file whose change IS the trigger, not to code paths.)

## Behaviour

1. Checkout with a token that can push back to the branch (or open a PR if
   protected).
2. Read `version.json` → `VER`.
3. Run `node scripts/update-stale-version-refs.mjs --write` (renamed from the
   current human-invoked script; keep the same rewrite rules).
4. If files changed: `git add -A && git commit -m "chore: propagate version ${VER} [skip ci]" && git push`.
5. If nothing changed: exit 0 with a note.

## Guardrails

- Never edit `version.json` itself.
- Never edit `changelog.md` history entries (only prepend a stub is allowed and
  is out of scope for this subtask).
- Fail loudly if the propagator errors — do NOT swallow.

## Follow-up

Once this workflow is proven, delete the "run the propagator locally" step
from every doc and memory file (parent step 8).
