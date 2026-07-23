/**
 * plan-next-prompts.ts - seed rows for the Prompt table.
 *
 * The default Plan and Next chip bodies come from the generated prompt bundle,
 * which is built from standalone-scripts/prompts/13-next-tasks/prompt.md and
 * standalone-scripts/prompts/14-plan-steps/prompt.md. Do not hand-copy those
 * prompt bodies into this file again.
 */

import type { PromptRole } from '../types/prompt-role';
import { extractParamTokens } from '../db/prompt-token-guard';
import { DiagnosticError } from '../errors/diagnostic-error';
import bundledPromptBundle from '../../03-macro-prompts.json';

interface BundledPromptEntry {
    slug?: string;
    text?: string;
}

interface BundledPromptBundle {
    prompts?: BundledPromptEntry[];
}

const PROMPT_BUNDLE = bundledPromptBundle as BundledPromptBundle;
const PLAN_STEPS_SLUG = 'plan-steps';
const NEXT_STEPS_SLUG = 'next-steps';

function findBundledPromptText(slug: string): string {
    const entry = PROMPT_BUNDLE.prompts?.find(candidate => candidate.slug === slug);
    if (typeof entry?.text === 'string' && entry.text.length > 0) return entry.text;
    throw new DiagnosticError('SEED_BUNDLE_E001', { slug, reason: 'prompt text missing' });
}

export const PLAN_DEFAULT_BODY: string = findBundledPromptText(PLAN_STEPS_SLUG);
export const NEXT_DEFAULT_BODY: string = findBundledPromptText(NEXT_STEPS_SLUG);

/**
 * Legacy plan-default bodies previously shipped before the prompt bundle became
 * the single source for chip defaults. Newest legacy last.
 */
export const PLAN_DEFAULT_LEGACY_BODIES: string[] = [
    [
        '# {{n}} number of steps plan, maximum enforcement',
        '',
        '## RULE 0, step count is law',
        '',
        'Produce EXACTLY `{{n}}` steps. Not `{{n}}-1`, not `{{n}}+1`.',
        '',
        '## Hard rules (non-negotiable, auto-reject on violation)',
        '',
        '1. Nothing executes this turn. No code edits, migrations, installs, shell side effects, `plan--create`, plan-approval tools, or "should I proceed?" prompts. Files only.',
        '2. Spec first, then plan. Order is fixed.',
        '3. `XX` is the next free 2-digit sequence across `pending/` + `completed/` combined.',
    ].join('\n'),
    [
        '# {{n}} steps Plan, Maximal Enforcement',
        '',
        'Parse the number {{n}} in this prompt\'s header. That number is the EXACT count of steps in the plan you must write.',
        '',
        '## Rules - non-negotiable',
        '',
        '1. DO NOT execute anything this turn. No code edits, no migrations, no installs.',
    ].join('\n'),
];

/**
 * Legacy next-default bodies previously shipped before the prompt bundle became
 * the single source for chip defaults. Newest legacy last.
 */
export const NEXT_DEFAULT_LEGACY_BODIES: string[] = [
    [
        '# Next {{n}} Steps or Tasks',
        '',
        '## Source of truth',
        '',
        'Locate the relevant plan file under `.lovable/plans/pending/XX-<slug>.md`.',
        '',
        '## What I want',
        '',
        '1. Give me the NEXT {{n}} STEPS from that plan.',
        '2. Then list every remaining item after those {{n}}.',
    ].join('\n'),
    [
        '# Next {{n}} steps or tasks (v3.2)',
        '',
        '## RULE 0 - EXACTLY `{{n}}` NEXT STEPS (MUST)',
        '',
        'Give exactly {{n}} next steps and every remaining item after that.',
    ].join('\n'),
];

export interface SeedPromptRow {
    slug: string;
    name: string;
    body: string;
    role: PromptRole;
    isDefault: boolean;
}

export const PLAN_NEXT_SEED_ROWS: SeedPromptRow[] = [
    { slug: 'plan-default', name: 'Plan (default)', body: PLAN_DEFAULT_BODY, role: 'plan', isDefault: true },
    { slug: 'plan-concise', name: 'Plan (concise)', body: '# Plan in {{n}} steps (concise)\n\nWrite exactly {{n}} numbered steps. No preamble, no rationale block per step, one line each. TODO(user): replace with final concise variant.', role: 'plan', isDefault: false },
    { slug: 'plan-with-evidence', name: 'Plan (evidence-first)', body: '# Plan in {{n}} steps (evidence-first)\n\nFor each of the {{n}} steps include a verifiable evidence artifact path. TODO(user): replace with final evidence-first variant.', role: 'plan', isDefault: false },
    { slug: 'plan-risk-annotated', name: 'Plan (risk-annotated)', body: '# Plan in {{n}} steps (risk-annotated)\n\nAnnotate each of the {{n}} steps with a risk score 1-5 and a rollback note per step. TODO(user): replace with final risk-annotated variant.', role: 'plan', isDefault: false },
    { slug: 'next-default', name: 'Next (default)', body: NEXT_DEFAULT_BODY, role: 'next', isDefault: true },
    { slug: 'next-concise', name: 'Next (concise)', body: 'Give me the next {{n}} steps from the current pending plan. One line each, no rationale. TODO(user): replace with final concise variant.', role: 'next', isDefault: false },
    { slug: 'next-with-time', name: 'Next (time-estimate)', body: 'Give me the next {{n}} steps from the current pending plan, each with a realistic time estimate and what it unblocks. TODO(user): replace with final time-estimate variant.', role: 'next', isDefault: false },
    { slug: 'next-with-risk', name: 'Next (risk-first)', body: 'Give me the next {{n}} steps from the current pending plan, sorted by risk descending, with a rollback note per step. TODO(user): replace with final risk-first variant.', role: 'next', isDefault: false },
];

export function getSeedBodyForSlug(slug: string): string | null {
    for (const row of PLAN_NEXT_SEED_ROWS) {
        if (row.slug === slug) return row.body;
    }
    return null;
}

export function getRequiredTokensForRole(role: PromptRole): string[] {
    if (role === 'generic') return [];
    const defaultRow = PLAN_NEXT_SEED_ROWS.find(row => row.role === role && row.isDefault);
    if (!defaultRow) return [];
    return Array.from(new Set(extractParamTokens(defaultRow.body)));
}