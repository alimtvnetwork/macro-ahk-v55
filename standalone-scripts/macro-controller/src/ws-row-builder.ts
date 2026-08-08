import type { WorkspaceCredit } from './types';
import { cPrimaryLight, cPrimaryHL, cPrimaryBgAL, cWarning, getLoopWsCheckedIds } from './shared-state';
import { resolveCreditSummary } from './credit-balance-update/credit-summary-resolver';
import { renderCreditBar } from './credit-api';
import { viewState } from './ws-view-state';
import { buildLoopTooltipText } from './ws-tooltip-builder';
import { buildTierBadgeHtml } from './ws-status-badges';

const CSS_BG = ';background:';

export function wsStatusEmoji(isCurrent: boolean, available: number, limitInt: number): string {
  if (isCurrent) return '📍';
  if (available <= 0) return '🔴';
  if (available <= limitInt * 0.2) return '🟡';

  return '🟢';
}

export function wsRowBgStyle(isCurrent: boolean, isSel: boolean): string {
  if (isCurrent) return 'background:' + cPrimaryHL + ';border-left:3px solid #a78bfa;';

  return isSel ? 'border-left:3px solid #facc15;' : 'border-left:3px solid transparent;';
}

export function buildWsRowInnerHtml(
  ws: WorkspaceCredit, isCurrent: boolean, isChecked: boolean,
  emoji: string, creditBarHtml: string,
): string {
  const tierBadge = buildTierBadgeHtml(ws);
  const nameColor = isCurrent ? '#67e8f9' : '#e2e8f0';
  const nameBold = isCurrent ? 'font-weight:800;' : 'font-weight:500;';

  let html = '<span class="loop-ws-checkbox" style="font-size:11px;cursor:pointer;color:' + (isChecked ? '#a78bfa' : '#64748b') + ';user-select:none;flex-shrink:0;">' + (isChecked ? '☑' : '☐') + '</span>'
    + '<span style="font-size:12px;">' + emoji + '</span>'
    + '<div style="flex:1;min-width:0;">'
    + '<div class="loop-ws-name" style="color:' + nameColor + ';font-size:11px;' + nameBold + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (ws.fullName || ws.name) + tierBadge + '</div>'
    + '<div style="display:flex;align-items:center;gap:4px;margin-top:2px;">' + creditBarHtml + '</div>'
    + '</div>';
  if (isCurrent) {
    html += '<span style="font-size:8px;color:' + cPrimaryLight + CSS_BG + cPrimaryBgAL + ';padding:1px 4px;border-radius:3px;font-weight:700;">NOW</span>';
  }

  return html;
}

export function buildCreditPlaceholderBarHtml(isPending: boolean, dashTooltip: string): string {
  if (isPending) {
    return '<span class="marco-skeleton" title="' + dashTooltip + '" style="display:inline-block;min-width:160px;height:8px;vertical-align:middle;"></span>';
  }

  return '<span title="' + dashTooltip + '" style="display:inline-block;min-width:160px;height:2px;background:' + cWarning + ';vertical-align:middle;border-radius:2px;opacity:0.85;"></span>';
}

export function buildWsRow(
  ws: WorkspaceCredit, wsIndex: number, isCurrent: boolean,
  count: number, maxTotalCredits: number,
  selIdValue: string | false, dataAttrWsId: string, dataAttrWsName: string, dataAttrWsCurrent: string,
): HTMLDivElement {
  const creditSummary = resolveCreditSummary(ws);
  const available = creditSummary.available;
  const limitInt = creditSummary.billingLimit;
  const emoji = wsStatusEmoji(isCurrent, available, limitInt);
  const wsId = String(ws.id || (ws.raw && ws.raw.id) || '');
  const isSel = selIdValue === wsId;
  const isChecked = !!getLoopWsCheckedIds()[wsId];
  const tooltip = buildLoopTooltipText(ws).replace(/"/g, '&quot;');

  const row = document.createElement('div');
  row.className = 'loop-ws-item';
  row.setAttribute(dataAttrWsId, wsId);
  row.setAttribute(dataAttrWsName, ws.fullName || ws.name);
  row.setAttribute(dataAttrWsCurrent, isCurrent ? 'true' : 'false');
  row.setAttribute('data-ws-idx', String(count));
  row.setAttribute('data-ws-raw-idx', String(wsIndex));
  row.setAttribute('data-marco-tip', tooltip);
  row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:7px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.05);transition:background 0.15s;font-size:11px;' + wsRowBgStyle(isCurrent, isSel);

  const isPending = creditSummary.source === 'Pending';
  const dashTooltip = isPending
    ? 'Fetching credit balance… click 💰 Credits to refresh'
    : 'Credit-balance request timed out — click 💰 Credits to retry';
  const placeholderBarHtml = buildCreditPlaceholderBarHtml(isPending, dashTooltip);
  const creditBarHtml = creditSummary.renderDash
    ? placeholderBarHtml
    : renderCreditBar({
      totalCredits: creditSummary.total, available: creditSummary.available, totalUsed: creditSummary.totalUsed,
      freeRemaining: Math.round(ws.freeRemaining || 0), freeGranted: Math.round(ws.freeGranted || 0),
      billingAvail: creditSummary.billingAvailable, billingLimit: creditSummary.billingLimit,
      rollover: creditSummary.rollover, rolloverLimit: creditSummary.rolloverLimit,
      dailyFree: creditSummary.daily, dailyLimit: creditSummary.dailyLimit,
      compact: viewState().getCompactMode(), maxTotalCredits,
    });

  row.innerHTML = buildWsRowInnerHtml(ws, isCurrent, isChecked, emoji, creditBarHtml);

  return row;
}
