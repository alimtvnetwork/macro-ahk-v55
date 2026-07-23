/**
 * Tests for the on-demand reseed CLI/UI command (reseed-command.ts).
 * Covers:
 *   R1. Idempotent path calls seedPlanNextPrompts and returns ok.
 *   R2. Force path issues UPDATE for every default row, returns forcedUpdates count.
 *   R3. Force UPDATE failure surfaces error (never swallowed).
 *   R4. installReseedCommandGlobal attaches once and is idempotent.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let responsesQueue: unknown[] = [];

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async (_c: string, p: { method: string; params: { sql: string } }) => {
        captured.push({ method: p.method, sql: p.params.sql });
        return responsesQueue.shift() ?? { isOk: true, rows: [] };
    }),
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logError: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));

import { reseedPromptsOnDemand, installReseedCommandGlobal } from '../reseed-command';
import { PLAN_NEXT_SEED_ROWS } from '../plan-next-prompts';

const OK = (): unknown => ({ isOk: true, rows: [] });
const OK_ROW = (): unknown => ({ isOk: true, rows: [{ '1': 1 }] });

function queueHappySeed(): void {
    // Matches seedPlanNextPrompts happy-path shape used elsewhere in tests.
    responsesQueue = [
        OK_ROW(),                          // pre-select existing slugs
        OK(),                              // INSERT OR IGNORE
        // legacy upgrade probes + promote defaults (all no-op safe)
        OK(), OK(), OK(), OK(), OK(), OK(), OK(), OK(), OK(), OK(),
    ];
}

beforeEach(() => {
    captured.length = 0;
    responsesQueue = [];
    delete (window as unknown as { __marcoReseedPrompts?: unknown }).__marcoReseedPrompts;
});

describe('reseedPromptsOnDemand', () => {
    it('R1: idempotent path completes and returns ok', async () => {
        queueHappySeed();
        const r = await reseedPromptsOnDemand();
        expect(r.ok).toBe(true);
        expect(r.mode).toBe('idempotent');
        expect(r.forcedUpdates).toBeUndefined();
    });

    it('R2: force path issues UPDATE per default row and reports count', async () => {
        queueHappySeed();
        const defaults = PLAN_NEXT_SEED_ROWS.filter(r => r.isDefault);
        for (let i = 0; i < defaults.length; i++) responsesQueue.push(OK());
        const r = await reseedPromptsOnDemand({ force: true });
        expect(r.ok).toBe(true);
        expect(r.mode).toBe('force');
        expect(r.forcedUpdates).toBe(defaults.length);
        // Verify at least one UPDATE was issued mentioning a canonical slug.
        const updates = captured.filter(c => c.sql.startsWith('UPDATE Prompt SET Body'));
        expect(updates.length).toBe(defaults.length);
    });

    it('R3: force UPDATE failure surfaces error and returns ok:false', async () => {
        const { sendToExtension } = await import('../../ui/prompt-loader');
        (sendToExtension as unknown as { mockImplementation: (impl: (c: string, p: { params: { sql: string } }) => Promise<unknown>) => void })
            .mockImplementation(async (_c: string, p: { params: { sql: string } }) => {
                if (p.params.sql.startsWith('UPDATE Prompt SET Body')) {
                    return { isOk: false, errorMessage: 'disk full' };
                }
                return { isOk: true, rows: [] };
            });
        const r = await reseedPromptsOnDemand({ force: true });
        expect(r.ok).toBe(false);
        expect(r.error).toContain('disk full');
    });

    it('R4: installReseedCommandGlobal is idempotent', () => {
        installReseedCommandGlobal();
        const first = (window as unknown as { __marcoReseedPrompts?: unknown }).__marcoReseedPrompts;
        expect(typeof first).toBe('function');
        installReseedCommandGlobal();
        const second = (window as unknown as { __marcoReseedPrompts?: unknown }).__marcoReseedPrompts;
        expect(second).toBe(first);
    });
});
