---
name: message-relay allow-list must include PROJECT_API
description: Every db/* call from standalone-scripts posts sendToExtension('PROJECT_API',...); the content-script relay drops any type not in ALLOWED_TYPES with a "Blocked disallowed message type" error, breaking Prompt Library, seeder, and role-scoped saves.
type: constraint
---
**What happened.** Opening Prompt Library rendered three red "Load error: Blocked disallowed message type: PROJECT_API" rows (plan/next/generic). Root cause: `src/content-scripts/message-relay.ts` maintains a static `ALLOWED_TYPES` Set of forwardable message types. When `PROJECT_API` is missing from that set, `postMessage` payloads from `sendToExtension('PROJECT_API', ...)` are rejected before reaching the service worker, so every DB call (`prompt-db`, `prompt-revision-db`, `prompt-role-db`, `macro-db`, `project-chat-submit-db`, `seed-plan-next`, `reseed-command`, `database-json-migrate`, `database-modal-data`) fails synchronously.

**Why it recurred.** The allow-list is authored by hand and the DB layer is authored inside `standalone-scripts/`. There is no shared constant, so adding a new relay message type without updating this Set silently disables entire feature areas.

**How to prevent.**
1. `PROJECT_API` MUST stay in `ALLOWED_TYPES` in `src/content-scripts/message-relay.ts`.
2. When introducing a new relay message type, add it to `ALLOWED_TYPES` in the same diff.
3. Regression locked by `src/test/regression/message-relay-allowlist.test.ts` (asserts `PROJECT_API` and other critical types are present in the source).
