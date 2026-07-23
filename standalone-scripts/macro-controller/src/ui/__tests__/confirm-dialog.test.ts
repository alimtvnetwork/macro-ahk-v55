import { describe, it, expect } from 'vitest';
import { confirmDialog } from '../confirm-dialog';

function getOverlay(): HTMLElement | null {
  return document.querySelector('[data-marco-confirm]');
}

describe('confirmDialog', () => {
  it('resolves false when Cancel is clicked', async () => {
    const p = confirmDialog({ title: 'Delete?', message: 'Really?' });
    await Promise.resolve();
    const overlay = getOverlay()!;
    expect(overlay).toBeTruthy();
    const cancelBtn = overlay.querySelectorAll('button')[0] as HTMLButtonElement;
    cancelBtn.click();
    await expect(p).resolves.toBe(false);
    expect(getOverlay()).toBeNull();
  });

  it('resolves true when the destructive button is clicked', async () => {
    const p = confirmDialog({ title: 'Delete?', message: 'Really?', confirmLabel: 'Delete' });
    await Promise.resolve();
    const overlay = getOverlay()!;
    const confirmBtn = overlay.querySelectorAll('button')[1] as HTMLButtonElement;
    confirmBtn.click();
    await expect(p).resolves.toBe(true);
  });

  it('Escape key cancels', async () => {
    const p = confirmDialog({ title: 'x', message: 'y' });
    await Promise.resolve();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(p).resolves.toBe(false);
  });

  it('focuses Cancel by default so Enter does not auto-confirm', async () => {
    const p = confirmDialog({ title: 'x', message: 'y' });
    await Promise.resolve();
    const overlay = getOverlay()!;
    const cancelBtn = overlay.querySelectorAll('button')[0] as HTMLButtonElement;
    expect(document.activeElement).toBe(cancelBtn);
    // Enter on Cancel-focused dialog should not resolve true.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    // Give it a tick; then click Cancel to close.
    cancelBtn.click();
    await expect(p).resolves.toBe(false);
  });
});
