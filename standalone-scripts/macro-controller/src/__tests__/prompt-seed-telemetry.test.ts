import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    emitPromptSeedEvent,
    readPromptSeedTrace,
    clearPromptSeedTrace,
    PROMPT_SEED_TRACE_MAX,
} from '../telemetry/prompt-seed-telemetry';
import { StorageKey } from '../types/storage-keys';

vi.mock('../logging', () => ({ log: vi.fn() }));
vi.mock('../error-utils', () => ({ logError: vi.fn() }));

describe('prompt-seed-telemetry', () => {
    beforeEach(() => {
        localStorage.clear();
        clearPromptSeedTrace();
    });

    it('emits an event with iso timestamp and default outcome=ok', () => {
        const evt = emitPromptSeedEvent({ event: 'seed.start' });
        expect(evt.event).toBe('seed.start');
        expect(evt.outcome).toBe('ok');
        expect(new Date(evt.at).toString()).not.toBe('Invalid Date');
    });

    it('persists events to the ring buffer under StorageKey.PromptSeedTrace', () => {
        emitPromptSeedEvent({ event: 'seed.start' });
        emitPromptSeedEvent({
            event: 'seed.legacy-upgrade', role: 'next', slug: 'next-default',
            outcome: 'ok', metrics: { legacyIndex: 0, newBodyLen: 42 },
        });
        const raw = localStorage.getItem(StorageKey.PromptSeedTrace);
        expect(raw).not.toBeNull();
        const trace = readPromptSeedTrace();
        expect(trace).toHaveLength(2);
        expect(trace[1]?.metrics?.legacyIndex).toBe(0);
        expect(trace[1]?.slug).toBe('next-default');
    });

    it('caps the ring buffer at PROMPT_SEED_TRACE_MAX', () => {
        for (let i = 0; i < PROMPT_SEED_TRACE_MAX + 10; i += 1) {
            emitPromptSeedEvent({ event: 'seed.start', metrics: { i } });
        }
        const trace = readPromptSeedTrace();
        expect(trace).toHaveLength(PROMPT_SEED_TRACE_MAX);
        // Oldest events were shifted out
        expect(trace[0]?.metrics?.i).toBe(10);
    });

    it('dispatches a window CustomEvent for subscribers', () => {
        const detail: unknown[] = [];
        const listener = (e: Event): void => {
            detail.push((e as CustomEvent).detail);
        };
        window.addEventListener('marco:prompt-seed-trace', listener);
        emitPromptSeedEvent({ event: 'editor.prefill.db-hit', role: 'plan', outcome: 'ok' });
        window.removeEventListener('marco:prompt-seed-trace', listener);
        expect(detail).toHaveLength(1);
        expect((detail[0] as { event: string }).event).toBe('editor.prefill.db-hit');
    });

    it('clearPromptSeedTrace removes buffer entries', () => {
        emitPromptSeedEvent({ event: 'seed.start' });
        expect(readPromptSeedTrace()).toHaveLength(1);
        clearPromptSeedTrace();
        expect(readPromptSeedTrace()).toHaveLength(0);
    });
});
