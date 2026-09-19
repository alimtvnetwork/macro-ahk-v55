# 02 — Non-Negotiables (Hard Bans)

Violating any item below = automatic PR rejection. No exceptions without explicit user override in the same PR description.

| # | Ban | Memory anchor |
|---|---|---|
| 1 | **No Supabase** (SDK, auth, tokens, localStorage keys) | `mem://constraints/no-supabase` |
| 2 | **No Storage PascalCase rewrite** (Phase 2c-storage v2) | `mem://constraints/no-storage-pascalcase-migration` |
| 3 | **No retry / exponential backoff** unless authorized | `mem://constraints/no-retry-policy` |
| 4 | **No `readme.txt` auto-write** (time, clock, timestamp, git-stamp) | `mem://constraints/readme-txt-prohibitions` (SP-1..SP-7) |
| 5 | **No CI build notifications** (emails, webhooks) | `mem://constraints/no-ci-notifications` |
| 6 | **No light theme / theme toggle** | `mem://preferences/dark-only-theme` |
| 7 | **No external animation libs** (`framer-motion`, `gsap`) | `mem://style/animation-strategy` |
| 8 | **No edits to `skipped/**` or `.release/**`** | `mem://constraints/skipped-folders` |
| 9 | **No bare `console.error`** — use `<NAMESPACE>.Logger.error` | `mem://standards/error-logging-via-namespace-logger.md` |
| 10 | **No swallowed errors** (`catch {}`, `.catch(()=>{})`) | `mem://features/error-swallow-audit-generator` |
| 11 | **No `unknown` outside `CaughtError`** | `mem://standards/unknown-usage-policy` |
| 12 | **No short variable names** (`val`, `fn`, `cb`, `el`, `msg`, `ctx`, `obj`) | `mem://architecture/constant-naming-convention` |
| 13 | **No CI workflow path/branch filters** on `ci.yml` | `mem://constraints/ci-push-trigger-unfiltered` |
| 14 | **No webhook retry queue** (result webhook = single attempt) | `mem://constraints/webhook-fail-fast.md` |
| 15 | **No timer/observer without paired teardown** | `mem://standards/timer-and-observer-teardown` |

Each ban has a CI guard or audit script (see `scripts/`). If a guard fires, fix the code — never disable the guard.
