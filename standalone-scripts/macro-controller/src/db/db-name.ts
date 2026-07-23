/**
 * Leaf module: canonical SQLite project name for the macro-controller.
 *
 * Extracted from `db/macro-db.ts` (Plan-17 step 6) so dependents can reference
 * DB_NAME without pulling in `macro-db.ts` and its transitive imports
 * (`ui/prompt-loader`, `logging`, etc.). This breaks the runtime cycles
 *   db/macro-db.ts <-> seed/seed-plan-next.ts
 *   db/macro-db.ts <-> db/prompt-role-db.ts (via seed)
 *   db/macro-db.ts <-> db/prompt-db.ts (via plan-task-ui)
 *   db/macro-db.ts <-> db/project-chat-submit-db.ts (via capture chain)
 * observed by `scripts/check-madge-cycles.mjs`.
 *
 * Must remain dependency-free (no imports). Do NOT add logging, DB helpers,
 * or type-only imports here.
 */

export const DB_NAME = 'prompts.macro';
