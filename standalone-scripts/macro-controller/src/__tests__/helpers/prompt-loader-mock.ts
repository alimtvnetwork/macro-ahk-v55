/**
 * Shared vitest mock factory for `src/ui/prompt-loader.ts`.
 *
 * Tests that mock `../ui/prompt-loader` MUST include `sendToExtension`
 * because `runSql` (in `src/db/prompt-db.ts`) reads it via a getter and
 * vitest throws "No 'sendToExtension' export is defined on the mock"
 * when it is absent, even for code paths a test does not intend to
 * exercise (e.g. `resolveConfiguredChipValues` fired inside a submenu
 * render). See v4.187.0 release notes for the historical incident.
 *
 * Usage in a test file:
 *
 *     import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';
 *     vi.mock('../ui/prompt-loader', () => buildPromptLoaderMock({
 *         getPromptsConfig: () => ({ editorXPath: '//div' }),
 *     }));
 *
 * The default `sendToExtension` returns `{ isOk: true, rows: [] }` so
 * downstream `runSql` consumers see an "empty result" and take their
 * fallback branch. Override it via `overrides.sendToExtension` when a
 * test needs to script SQL responses.
 */

export interface PromptLoaderMockShape {
    sendToExtension: (channel: string, payload: unknown) => Promise<{ isOk: boolean; rows?: unknown[]; errorMessage?: string }>;
    getPromptsConfig?: () => { editorXPath: string };
    // Free-form overrides: additional named exports the code under test
    // may look up on the prompt-loader module.
    [key: string]: unknown;
}

export function buildPromptLoaderMock(overrides: Partial<PromptLoaderMockShape> = {}): PromptLoaderMockShape {
    const defaults: PromptLoaderMockShape = {
        sendToExtension: async () => ({ isOk: true, rows: [] }),
        getPromptsConfig: () => ({ editorXPath: '//div' }),
    };
    return { ...defaults, ...overrides };
}
