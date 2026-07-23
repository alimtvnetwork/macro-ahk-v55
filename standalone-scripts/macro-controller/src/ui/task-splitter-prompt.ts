/**
 * Task-splitter prompt builder.
 *
 * Wraps a user's long instruction with a fixed system preamble that asks
 * the LLM to split it into EXACTLY N self-contained subtasks, returning
 * strict JSON. No prose, no markdown fences, no commentary.
 *
 * Plan: .lovable/plans/pending/08-task-splitter-and-next-queue.md (step 2).
 */

import { throwDiagnostic } from '../errors/diagnostic-error';

export const SPLITTER_JSON_SHAPE = '{ "subtasks": string[] }';

const MIN_N = 1;
const MAX_N = 100;

export interface SplitterPromptOptions {
    readonly rawInstruction: string;
    readonly n: number;
}

export const validateSplitterN = (n: number): number => {
    if (!Number.isFinite(n) || Math.floor(n) !== n) {
        throwDiagnostic('SPLITTER_INVALID_N_E001', { rawValue: String(n) });
    }
    if (n < MIN_N || n > MAX_N) {
        throwDiagnostic('SPLITTER_INVALID_N_E002', { value: n, minN: MIN_N, maxN: MAX_N });
    }
    return n;
};

export const getSplitterPrompt = (options: SplitterPromptOptions): string => {
    const n = validateSplitterN(options.n);
    const raw = options.rawInstruction.trim();
    if (raw.length === 0) {
        throwDiagnostic('SPLITTER_EMPTY_INSTRUCTION_E001', { inputLength: options.rawInstruction.length });
    }

    return [
        `Split the following instruction into EXACTLY ${n} self-contained, ordered subtasks numbered 1..${n}.`,
        `Each subtask must be independently actionable and preserve the original intent.`,
        `Respond with STRICT JSON matching this shape and nothing else: ${SPLITTER_JSON_SHAPE}`,
        `No prose, no markdown code fences, no commentary outside the JSON.`,
        `The "subtasks" array MUST have length === ${n}.`,
        ``,
        `--- INSTRUCTION START ---`,
        raw,
        `--- INSTRUCTION END ---`,
    ].join("\n");
};
