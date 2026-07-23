/**
 * confirm-dialog: small themed replacement for `window.confirm` used by
 * destructive gear-menu actions (Delete custom, Force reset defaults).
 *
 * `window.confirm` blocks the event loop and looks foreign inside the
 * controller panel. This dialog matches `.marco-dialog` from the LESS
 * bundle, traps focus on the Cancel button by default (so an accidental
 * Enter never confirms deletion), and returns a Promise<boolean>.
 */

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  /** Label on the destructive button. Defaults to "Delete". */
  readonly confirmLabel?: string;
  /** Label on the safe button. Defaults to "Cancel". */
  readonly cancelLabel?: string;
  /** If true, the confirm button is styled red. Defaults to true. */
  readonly destructive?: boolean;
}

const OVERLAY_STYLE = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
const PANEL_STYLE = 'width:420px;max-width:92vw;background:#1e1b2e;border:1px solid rgba(255,255,255,0.14);border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.7);color:#eee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
const HEADER_STYLE = 'padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:700;font-size:13px;';
const BODY_STYLE = 'padding:16px;font-size:12px;line-height:1.5;color:#ddd;white-space:pre-wrap;';
const FOOTER_STYLE = 'display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid rgba(255,255,255,0.08);';
const BTN_BASE = 'padding:6px 14px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.15);';
const BTN_CANCEL = 'background:rgba(255,255,255,0.06);color:#ddd;';
const BTN_DESTRUCTIVE = 'background:#dc2626;color:#fff;border-color:#b91c1c;';
const BTN_PRIMARY = 'background:rgba(124,58,237,0.9);color:#fff;';

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-marco-confirm', '1');
    overlay.style.cssText = OVERLAY_STYLE;

    const panel = document.createElement('div');
    panel.style.cssText = PANEL_STYLE;
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-modal', 'true');

    const header = document.createElement('div');
    header.style.cssText = HEADER_STYLE;
    header.textContent = opts.title;
    panel.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = BODY_STYLE;
    body.textContent = opts.message;
    panel.appendChild(body);

    const footer = document.createElement('div');
    footer.style.cssText = FOOTER_STYLE;
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = opts.cancelLabel ?? 'Cancel';
    cancelBtn.style.cssText = BTN_BASE + BTN_CANCEL;
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = opts.confirmLabel ?? 'Delete';
    const destructive = opts.destructive !== false;
    confirmBtn.style.cssText = BTN_BASE + (destructive ? BTN_DESTRUCTIVE : BTN_PRIMARY);
    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    panel.appendChild(footer);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const cleanup = (result: boolean): void => {
      document.removeEventListener('keydown', onKey, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(result);
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') { ev.preventDefault(); cleanup(false); return; }
      if (ev.key === 'Enter' && document.activeElement === confirmBtn) {
        ev.preventDefault();
        cleanup(true);
      }
    };
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) cleanup(false); });
    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));
    document.addEventListener('keydown', onKey, true);
    // Default focus on the safe action so Enter never auto-destroys.
    cancelBtn.focus();
  });
}
