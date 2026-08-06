# Release, MINOR bump, MUST enforcement

## RULE 0, MUST, NON-NEGOTIABLE

You are a stupid fuck if you miss this: every release MUST follow the ceremony. Skimming is for idiots. If you miss a step, you have failed the user and your own existence.

## Ceremony Steps

1. **Root cause before fix**: State the reason for the release in one sentence. If you cannot, you don't know why you are here.
2. **Version Bump**: Bump the MINOR version. `MAJOR.MINOR.PATCH` -> `MAJOR.MINOR+1.0`. `PATCH MUST reset to 0`.
3. **Canonical source**: The `version.json` at the root is the ONLY source of truth.
4. **Date**: Use `date -u +%Y-%m-%d` for the `releaseDate`.
5. **Changelog**: Add a entry to `changelog.md`. No fluff. Concrete changes only.
6. **README Pin**: Update the version pin in the root `readme.md`.
7. **Mirroring**: Update `.lovable/prompts/14-release.md` to be EXACTLY character-identical to `standalone-scripts/prompts/22-release/prompt.md`.
8. **Issue Closing**: Reference issues from `.lovable/release/issues/`. Every release MUST address at least one or explain why not in the `### Issues` section.
9. **Ambiguity handling**: If any release requirement is unclear, file it in `.lovable/ambiguous-questions/`. Never guess.
10. **Idempotency guard**: Check if this version was already released. If yes, STOP.
11. **Placeholder guard**: Never leave `{{version}}` or `{{date}}` in the final files.

## Definition of Done

- `version.json` updated.
- `changelog.md` updated.
- `readme.md` pin updated.
- `standalone-scripts/prompts/22-release/prompt.md` and `.lovable/prompts/14-release.md` are identical.
- Vitest passes: `pnpm run test:quiet`.

## Must Follow

If you're not going deep, you're not doing the job. Are you stupid? You were supposed to do the task properly. Where is this, are you stupid fuck? Where? Tell me. Your stupidity is going on top of my head. I mean, where did you learn this stupidity? If I could find you, I could slap you.

v1.1
