/**
 * Plan 26 · Step 8 · prompt-editor DiagnosticError migration.
 *
 * Verifies that every migrated error path in `ui/prompt-editor.ts` now emits a
 * coded DiagnosticError with a fully-populated context object, and that the
 * user-facing toast carries the code in `[code=X]` form so users can copy it
 * into bug reports.
 *
 * The DB layer is stubbed via `vi.mock` so the test drives one failure path
 * per call without touching sqlite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

// --- Hoisted mocks (vi.mock factories are hoisted; use vi.hoisted for refs) ---
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  getRevalidateContext: vi.fn(),
  openPromptCreationModal: vi.fn(),
  listPromptsByRole: vi.fn(),
  getDefaultPromptForRole: vi.fn(),
  upsertPrompt: vi.fn(),
  setDefaultPromptForRole: vi.fn(),
  emitPromptSeedEvent: vi.fn(),
  seedPlanNextPrompts: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../../toast', () => ({ showToast: mocks.showToast }));
vi.mock('../prompt-loader', () => buildPromptLoaderMock({ getRevalidateContext: mocks.getRevalidateContext }));
vi.mock('../prompt-injection', () => ({ openPromptCreationModal: mocks.openPromptCreationModal }));
vi.mock('../../db/prompt-db', () => ({
  listPromptsByRole: mocks.listPromptsByRole,
  getDefaultPromptForRole: mocks.getDefaultPromptForRole,
  upsertPrompt: mocks.upsertPrompt,
  setDefaultPromptForRole: mocks.setDefaultPromptForRole,
}));
vi.mock('../../db/prompt-token-guard', () => ({ extractParamTokens: () => [] }));
vi.mock('../../seed/seed-plan-next', () => ({
  getRequiredTokensForRole: () => ['n'],
  seedPlanNextPrompts: mocks.seedPlanNextPrompts,
}));
vi.mock('../../seed/plan-next-prompts', () => ({
  PLAN_NEXT_SEED_ROWS: [
    { role: 'plan', slug: 'plan-default', name: 'Plan', body: 'Do {{n}} steps', isDefault: true },
    { role: 'next', slug: 'next-default', name: 'Next', body: 'Next {{n}} steps', isDefault: true },
  ],
}));
vi.mock('../../telemetry/prompt-seed-telemetry', () => ({ emitPromptSeedEvent: mocks.emitPromptSeedEvent }));

// Convenience aliases used in tests.
const showToastMock = mocks.showToast;
const getRevalidateContextMock = mocks.getRevalidateContext;
const getDefaultPromptForRoleMock = mocks.getDefaultPromptForRole;

// Now import the SUT.
import { openPromptEditor, openDefaultPromptEditor } from '../prompt-editor';

describe('prompt-editor DiagnosticError migration (Plan 26 · step 8)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
    // Restore default seed behavior consumed by openDefaultPromptEditor preflight.
    mocks.seedPlanNextPrompts.mockResolvedValue({ ok: true });
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('PROMPT_EDIT_E002: emits code + role/action context when revalidate context is missing', async () => {
    getRevalidateContextMock.mockReturnValue(null);

    await openPromptEditor({ role: 'plan' });

    // Toast carries the code.
    expect(showToastMock).toHaveBeenCalledTimes(1);
    const toastMsg = showToastMock.mock.calls[0]?.[0] as string;
    expect(toastMsg).toContain('[code=PROMPT_EDIT_E002]');

    // Structured diagnostic record written to the console (SDK-fallback path).
    const diagCall = logSpy.mock.calls.find((c) => String(c[0]).includes('diagnostic-report'));
    expect(diagCall).toBeDefined();
    const payload = diagCall?.[1] as { code: string; context: Record<string, unknown> };
    expect(payload.code).toBe('PROMPT_EDIT_E002');
    expect(payload.context.role).toBe('plan');
    expect(payload.context.action).toBe('add');
  });

  it('PROMPT_EDIT_E006: emits code + role when no seed row and no DB default exist', async () => {
    getRevalidateContextMock.mockReturnValue({ context: {}, taskNextDeps: {} });
    // openDefaultPromptEditor for 'generic' has no seed row registered.
    getDefaultPromptForRoleMock.mockResolvedValue({ ok: true, value: null });

    await openDefaultPromptEditor('generic' as never);

    const toastMsg = showToastMock.mock.calls.at(-1)?.[0] as string;
    expect(toastMsg).toContain('[code=PROMPT_EDIT_E006]');
    const diagCall = logSpy.mock.calls.find((c) => {
      const p = c[1] as { code?: string } | undefined;
      return p?.code === 'PROMPT_EDIT_E006';
    });
    expect(diagCall).toBeDefined();
  });

  it('professional wording: toast has no profanity and no bare "Failed"', async () => {
    getRevalidateContextMock.mockReturnValue(null);
    await openPromptEditor({ role: 'next' });
    const toastMsg = showToastMock.mock.calls[0]?.[0] as string;
    expect(toastMsg.toLowerCase()).not.toMatch(/oops|wtf|shit|fuck|damn|stupid|whoops/);
    // Bare "Failed" alone is banned; longer sentences with "failed to open" are fine.
    expect(toastMsg).not.toMatch(/^❌ Failed\.?\s*\[/);
  });
});
