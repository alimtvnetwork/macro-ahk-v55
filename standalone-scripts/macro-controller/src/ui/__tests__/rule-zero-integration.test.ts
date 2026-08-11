import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openPromptCreationModal } from '../prompt-injection';
import { PLAN_NEXT_SEED_ROWS } from '../../seed/plan-next-prompts';
import * as promptUtils from '../prompt-utils';
import { DbResult } from '../../db/db-result';

vi.mock('../../db/prompt-db', () => ({
  upsertPrompt: vi.fn().mockResolvedValue({ isSuccess: true, isFail: false, data: 1 }),
}));

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({
  logDiagnosticFromCode: vi.fn(),
  logError: vi.fn(),
}));

describe('Rule-0 save-time integration (Plan 22 gap #5)', () => {
  let showPasteToastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    showPasteToastSpy = vi.spyOn(promptUtils, 'showPasteToast').mockImplementation(() => {});
  });

  it('surfaces invalid {{n}} count via UI toast, not silently', async () => {
    const seedRow = PLAN_NEXT_SEED_ROWS.find((r) => r.slug === 'plan-default')!;
    openPromptCreationModal({} as never, {} as never, { id: 'db-row-1', slug: seedRow.slug, name: seedRow.name, text: 'Steps: 3\n\n## Steps\n1. one {{n}}\n' } as never, undefined, {
      requiredTokens: ['n'],
      roleLabel: 'PlanTierType',
      role: 'plan',
    });

    const overlay = document.getElementById('marco-prompt-modal')!;
    const saveBtn = Array.from(overlay.querySelectorAll('button')).find(
      (b) => b.textContent === '💾 Update',
    ) as HTMLButtonElement;

    // Force enable the button to simulate the UI state bypass or backend rejection
    saveBtn.disabled = false;
    saveBtn.click();

    // Wait for microtasks (promise resolution in the click handler)
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(showPasteToastSpy).toHaveBeenCalled();
    const toastMessage = showPasteToastSpy.mock.calls[0][0] as string;
    expect(toastMessage).toContain('Rule 0 (step count is law)');
    expect(toastMessage).toContain('EXACTLY 3');
  });
});
