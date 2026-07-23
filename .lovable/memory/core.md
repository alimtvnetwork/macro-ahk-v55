# Memory: Core (always in context)

Mirrors the Core section of `mem://index.md`. If they diverge, `mem://index.md` wins. Topic detail lives under `memory/<namespace>/` (see `MAP.md`).

- Never hardcode a timezone; render in the user's local timezone at render time (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Read-only folders: never modify `skipped/` or `.release/`.
- Supabase is forbidden anywhere in this project (auth, tokens, SDKs, storage).
- No Storage PascalCase migration (Phase 2c-storage v2 is banned).
- Unified versioning across `manifest.json`, `src/shared/constants.ts`, standalone-scripts. The phrase "bump version + add changelog + pin to root readme" triggers a release.
- Dark-only theme; no light mode or toggles.
- Zero ESLint warnings/errors; modular architecture.
- No `unknown` outside `CaughtError`; defensive property access (`?.`, `??`) required.
- Single-path `getBearerToken()` auth contract; no legacy paths.
- No retry / no exponential backoff; sequential fail-fast.
- Failure logs must include `Reason` + `ReasonDetail` and full `SelectorAttempts[]` / `VariableContext[]` where relevant.
- New-tab / blank URLs are guarded by `isNewTabOrBlankUrl()` in `src/shared/url-utils.ts`.
- `readme.txt`: strictly no time/clock/timestamp/git-update values (SP-1..SP-7).
- CI push trigger MUST be unfiltered (`on: push:` with no `branches`/`paths`).
- No per-invocation prompt archive files under `.lovable/prompts/`.
- No-Questions Mode active: log ambiguities under `.lovable/question-and-ambiguity/`, do not call `ask_questions`.
- `next` command always executes the next task in the same turn and ends with a flat numbered remaining list.

For the full memory index and topic files, see `mem://index.md`.
