// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pasteIntoEditor: vi.fn(async () => 'ok'),
  showPasteToast: vi.fn(),
  queue: {
    dequeue: vi.fn(async () => null),
    count: vi.fn(async () => 0),
  },
}));

vi.mock('../../logger', () => ({ log: vi.fn(), logSub: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));
vi.mock('../prompt-utils', () => ({
  pasteIntoEditor: mocks.pasteIntoEditor,
  showPasteToast: mocks.showPasteToast,
}));
vi.mock('../../queue-control/task-queue-project-store', () => ({
  getPersistentTaskQueue: () => mocks.queue,
  resolveTaskQueueProjectId: () => 'project',
}));

import { runTaskNextLoop, substituteTaskNextPromptText, taskNextState, type TaskNextDeps } from '../task-next-ui';

function depsWithNextPrompt(text: string, replaceKey = 'n'): TaskNextDeps {
  return {
    sendToExtension: vi.fn(),
    getByXPath: () => null,
    getPromptsConfig: () => ({
      entries: [{ name: 'Next Steps', slug: 'next-steps', text, replaceKey }],
    }),
  } as unknown as TaskNextDeps;
}

describe('Task Next token substitution', () => {
  beforeEach(() => {
    taskNextState.running = false;
    taskNextState.cancelled = false;
    mocks.pasteIntoEditor.mockClear();
    mocks.showPasteToast.mockClear();
    mocks.queue.dequeue.mockClear();
    mocks.queue.count.mockClear();
  });

  it('replaces {{n}} before the older Task Next button paste path writes to the editor', async () => {
    await runTaskNextLoop(depsWithNextPrompt('# Next {{n}} steps or tasks'), 5);

    const pasted = String(mocks.pasteIntoEditor.mock.calls[0]?.[0] ?? '');
    expect(pasted).toBe('# Next 5 steps or tasks');
    expect(pasted).not.toContain('{{n}}');
  });

  it('replaces legacy uppercase tokens and dollar tokens through the exported queue helper', () => {
    const text = substituteTaskNextPromptText({ text: 'Next {{N}} and ${n}', replaceKey: 'n' }, 3);

    expect(text).toBe('Next 3 and 3');
  });
});