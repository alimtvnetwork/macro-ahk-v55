/**
 * Regression: prompt deletion failure MUST surface a visible toast that
 * contains the actual error reason (never silent, never generic).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    showPasteToast: vi.fn(),
    logDiagnosticFromCode: vi.fn(),
}));

vi.mock('../prompt-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../prompt-utils')>();
    return {
        ...actual,
        showPasteToast: mocks.showPasteToast,
        pasteIntoEditor: vi.fn(),
    };
});
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('../../error-utils');
    return { ...actual, logDiagnosticFromCode: mocks.logDiagnosticFromCode };
});
vi.mock('../../logging', () => ({
    log: vi.fn(),
    getDisplayProjectName: vi.fn(() => ''),
}));

import { handlePromptDeleteFailure } from '../prompt-dropdown';

describe('handlePromptDeleteFailure', () => {
    beforeEach(() => {
        mocks.showPasteToast.mockReset();
        mocks.logDiagnosticFromCode.mockReset();
    });

    it('shows an error toast containing the actual failure reason', () => {
        const prompt = { id: 'p-42', name: 'My Prompt', slug: 'my-prompt', text: '', category: '' };
        const reason = 'IsDefault=1 rows are locked';

        handlePromptDeleteFailure(prompt as never, reason);

        expect(mocks.showPasteToast).toHaveBeenCalledTimes(1);
        const [message, isError] = mocks.showPasteToast.mock.calls[0]!;
        expect(isError).toBe(true);
        expect(String(message)).toContain(reason);
        expect(String(message).toLowerCase()).toContain('delete failed');
    });

    it('logs DB_WRITE_E004 with prompt id, name, and reason', () => {
        const prompt = { id: 'p-7', name: 'Alpha', slug: 'alpha', text: '', category: '' };
        const reason = 'DB constraint violation';
        const caught = new Error('boom');

        handlePromptDeleteFailure(prompt as never, reason, caught as never);

        expect(mocks.logDiagnosticFromCode).toHaveBeenCalledTimes(1);
        const [code, context, capturedError] = mocks.logDiagnosticFromCode.mock.calls[0]!;
        expect(code).toBe('DB_WRITE_E004');
        expect(context).toMatchObject({ promptId: 'p-7', name: 'Alpha', reason });
        expect(capturedError).toBe(caught);
    });
});
