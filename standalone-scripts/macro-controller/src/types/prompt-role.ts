/**
 * PromptRole - discriminator column for the Prompt table (plan-14, step 2).
 *
 * `plan`    - fires from the Plan chip in the Marco Inline strip.
 * `next`    - fires from the Next chip in the Marco Inline strip.
 * `generic` - default for all pre-existing prompts (no role assigned).
 *
 * The `PROMPT_ROLES` tuple is the single source of truth; the union type
 * and `isPromptRole` guard derive from it so adding/removing a role is a
 * one-line change and the exhaustiveness test in
 * `__tests__/prompt-role.test.ts` will fail loudly if drift occurs.
 */

import { throwDiagnostic } from '../errors/diagnostic-error';

export const PROMPT_ROLES = ['plan', 'next', 'generic'] as const;

export type PromptRole = typeof PROMPT_ROLES[number];

export function isPromptRole(value: unknown): value is PromptRole {
    return typeof value === 'string' && (PROMPT_ROLES as readonly string[]).includes(value);
}

/**
 * Compile-time exhaustiveness helper. Call from a `switch (role)` default
 * arm to force TS to error the moment a new role is added without a case.
 */
export function assertNeverRole(value: never): never {
    throwDiagnostic('TYPE_EXHAUSTIVE_E001', { discriminantValue: String(value), typeName: 'PromptRole' });
}
