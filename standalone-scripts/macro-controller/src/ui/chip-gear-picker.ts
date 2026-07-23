/**
 * Shared "pick one of role's prompts" modal used by the chip gear menu
 * items (Edit specific / Set active / Delete). Small dark dialog rendered
 * directly to the DOM so it inherits our theme without pulling the full
 * Prompt Library modal for a one-off pick.
 */

import type { PromptRole } from '../types/prompt-role';
import { listPromptsByRole, type PromptRow } from '../db/prompt-db';
import { logError } from '../error-utils';
import { showToast } from '../toast';
import { DiagnosticError } from '../errors/diagnostic-error';
import { showDiagnosticToast } from '../errors/show-diagnostic-toast';
import { isSqlBridgeContractError, resetSqlBridgeCache } from '../db/sql-bridge';

export interface PickPromptOptions {
  role: PromptRole;
  roleLabel: string;
  title: string;
  /** When true, hide the current default row from the list. */
  excludeDefault?: boolean;
  /** Optional confirm-button label (default "Select"). */
  confirmLabel?: string;
}

type LoadStage = 'initial-list' | 'auto-seed' | 'post-seed-list';

function reasonOf(err: unknown, fallback: string): string {
  if (err === null || err === undefined) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || fallback;
  try { return JSON.stringify(err); } catch { return fallback; }
}

export async function pickPromptFromRole(opts: PickPromptOptions): Promise<PromptRow | null> {
  let stage: LoadStage = 'initial-list';
  let seedAttempted = false;
  let initialReason: string | null = null;
  let seedReason: string | null = null;

  let res = await listPromptsByRole(opts.role);
  if (!res.ok) initialReason = res.error ?? 'listPromptsByRole returned !ok';

  // Retry-once on contract-shape failure: the sql-bridge may have cached a
  // method name the backend just started rejecting. Reset the cache and try
  // one fresh probe before falling through to auto-seed / diagnostic toast.
  if (!res.ok && isSqlBridgeContractError(initialReason ?? undefined)) {
    resetSqlBridgeCache();
    const retry = await listPromptsByRole(opts.role);
    if (retry.ok) { res = retry; initialReason = null; }
  }

  // Managed Plan/Next roles: auto-seed on empty or failed lookup, then retry
  // once, so users never see a scary "Failed to load" when the DB simply
  // hasn't been seeded yet (fresh install, legacy Role='generic' rows, etc.).
  const isManaged = opts.role === 'plan' || opts.role === 'next';
  const emptyOrFailed = !res.ok || ((res.value ?? []).length === 0);
  if (isManaged && emptyOrFailed) {
    stage = 'auto-seed';
    seedAttempted = true;
    try {
      const seedMod = await import('../seed/seed-plan-next');
      const seedRes = await seedMod.seedPlanNextPrompts();
      if (!seedRes.ok) {
        seedReason = seedRes.error ?? 'seedPlanNextPrompts returned !ok';
        logError('ChipGearPicker', 'auto-seed before pick failed for ' + opts.role, new Error(seedReason));
      }
      stage = 'post-seed-list';
      res = await listPromptsByRole(opts.role);
    } catch (err) {
      seedReason = reasonOf(err, 'auto-seed threw');
      logError('ChipGearPicker', 'auto-seed import/call threw for ' + opts.role, err);
    }
  }

  if (!res.ok) {
    const dbReason = res.error ?? 'listPromptsByRole returned !ok';
    // Second-chance rebuild: if the auto-seed path itself hit a contract
    // error, reset the bridge cache and retry the SELECT one more time.
    if (isSqlBridgeContractError(dbReason) || isSqlBridgeContractError(seedReason ?? undefined)) {
      resetSqlBridgeCache();
      const retry = await listPromptsByRole(opts.role);
      if (retry.ok) { res = retry; }
    }
  }
  if (!res.ok) {
    const dbReason = res.error ?? 'listPromptsByRole returned !ok';
    const detail = buildLoadFailureDetail({
      stage: stage,
      role: opts.role,
      roleLabel: opts.roleLabel,
      seedAttempted: seedAttempted,
      dbReason: dbReason,
      initialReason: initialReason,
      seedReason: seedReason,
    });
    const err = new DiagnosticError('PROMPT_LOAD_E001', {
      role: opts.role,
      roleLabel: opts.roleLabel,
      stage: stage,
      seedAttempted: String(seedAttempted),
      reason: detail,
    });
    showDiagnosticToast(err);
    return null;
  }
  const rows = (res.value ?? []).filter((r) => !opts.excludeDefault || r.IsDefault !== 1);
  if (rows.length === 0) {
    if (seedReason !== null) {
      showToast('⚠ No ' + opts.roleLabel + ' prompts available. Auto-seed reported: ' + seedReason, 'warn');
    } else {
      showToast('No ' + opts.roleLabel + ' prompts available', 'warn');
    }
    return null;
  }
  return await promptPickerModal(rows, opts);
}

interface LoadFailureDetailInput {
  readonly stage: LoadStage;
  readonly role: PromptRole;
  readonly roleLabel: string;
  readonly seedAttempted: boolean;
  readonly dbReason: string;
  readonly initialReason: string | null;
  readonly seedReason: string | null;
}

function buildLoadFailureDetail(input: LoadFailureDetailInput): string {
  const parts: string[] = [];
  parts.push('db=' + input.dbReason);
  if (input.initialReason !== null && input.stage !== 'initial-list') {
    parts.push('initial-list=' + input.initialReason);
  }
  if (input.seedAttempted) {
    parts.push('auto-seed=' + (input.seedReason ?? 'ok'));
  }
  return parts.join(' | ');
}




function promptPickerModal(rows: PromptRow[], opts: PickPromptOptions): Promise<PromptRow | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483647;display:flex;align-items:center;justify-content:center;';
    const dlg = document.createElement('div');
    dlg.style.cssText = 'min-width:340px;max-width:520px;max-height:70vh;display:flex;flex-direction:column;gap:10px;padding:16px;background:#1a1a2e;border:1px solid rgba(124,58,237,0.6);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.6);color:#e5e7eb;font:12px system-ui,-apple-system,sans-serif;';
    const h = document.createElement('div');
    h.textContent = opts.title;
    h.style.cssText = 'font-size:13px;font-weight:700;color:#c4b5fd;';
    dlg.appendChild(h);
    const sel = document.createElement('select');
    sel.size = Math.min(8, Math.max(4, rows.length));
    sel.style.cssText = 'width:100%;padding:6px 8px;background:#0f172a;border:1px solid rgba(148,163,184,0.35);border-radius:5px;color:#e5e7eb;font-size:12px;';
    for (const r of rows) {
      const o = document.createElement('option');
      o.value = String(r.Id);
      const marker = r.IsDefault === 1 ? '★ ' : '   ';
      o.textContent = marker + r.Name + '  [' + r.Slug + ']';
      sel.appendChild(o);
    }
    dlg.appendChild(sel);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:4px;';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'padding:6px 12px;background:transparent;border:1px solid rgba(148,163,184,0.35);border-radius:5px;color:#e5e7eb;cursor:pointer;font-size:12px;';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = opts.confirmLabel ?? 'Select';
    ok.style.cssText = 'padding:6px 14px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border:none;border-radius:5px;color:#fff;cursor:pointer;font-size:12px;font-weight:600;';
    row.appendChild(cancel); row.appendChild(ok);
    dlg.appendChild(row);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);

    const close = (v: PromptRow | null): void => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(v);
    };
    cancel.onclick = () => close(null);
    overlay.onclick = (e) => { if (e.target === overlay) close(null); };
    ok.onclick = () => {
      const id = Number(sel.value);
      const picked = rows.find((r) => r.Id === id) ?? null;
      close(picked);
    };
    sel.ondblclick = () => ok.click();
    sel.focus();
  });
}
