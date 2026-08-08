import type { WorkspaceCredit } from './types';
import { WsTierValue, isExpiredTier } from './types/subscription-status';
import { WS_TIER_LABELS, getEffectiveStatus, getWorkspaceLifecycleConfig, expiredDays, formatExpiryStartDate, formatExpiredDuration, formatDateDDMMMYY, formatDayCount, type WorkspaceStatus } from './credit-fetch';
import { REFILL_PRIORITY_WINDOW_DAYS } from './constants';
import { daysToRefillForWs } from './workspace-refill-priority';
import { classifyFromStatus, type WorkspaceDisplayStatus } from './workspace-display-status';
import { resolveBadgeStyle, diluteBadgeBg } from './workspace-badge-styles';
import { formatPlanDisplayLabel } from './credit-balance-update/plan-mapper';

const CSS_BG = ';background:';

export function buildStatusPillHtml(status: WorkspaceStatus, ws: WorkspaceCredit): string {
  const display: WorkspaceDisplayStatus = classifyFromStatus(status, ws);
  if (display.kind === 'normal' || !display.label) return '';
  const style = resolveBadgeStyle(display.tone);

  const tipParts: string[] = [display.label];
  if (display.sublabel) tipParts.push(display.sublabel);
  if (display.tooltip) tipParts.push(display.tooltip);
  if (status.kind === 'about-to-refill' && status.refillIso) {
    tipParts.push('Refills ' + formatDateDDMMMYY(status.refillIso) + ' (in ' + formatDayCount(status.daysToRefill) + ')');
  } else if (status.sinceIso) {
    const date = formatDateDDMMMYY(status.sinceIso);
    tipParts.push('Since ' + date + ' (' + formatDayCount(status.daysSince) + ')');
  }
  const tip = tipParts.join(' — ').replace(/"/g, '&quot;');

  let html = '<span class="marco-ws-status-pill marco-ws-status-' + display.kind
    + '" style="font-size:11px;color:' + style.fg
    + CSS_BG + style.bg
    + ';border:1px solid ' + style.border
    + ';padding:2px 7px;border-radius:4px;font-weight:700;margin-left:5px;vertical-align:middle;letter-spacing:0.3px;text-transform:none;"'
    + ' data-marco-tip="' + tip + '">' + display.label + '</span>';

  if (display.sublabel) {
    html += '<span class="marco-ws-status-sublabel marco-ws-status-' + display.kind + '-sublabel" style="font-size:11px;color:' + style.fg
      + ';background:' + diluteBadgeBg(style.bg, 0.35)
      + ';border:1px solid ' + style.border
      + ';padding:2px 6px;border-radius:4px;font-weight:600;margin-left:3px;vertical-align:middle;letter-spacing:0.3px;text-transform:none;"'
      + ' data-marco-tip="' + tip + '">' + display.sublabel + '</span>';
  }
  return html;
}

export function buildRefillBadgeHtml(ws: WorkspaceCredit): string {
  const days = daysToRefillForWs(ws);
  if (days === null) return '';
  if (days > REFILL_PRIORITY_WINDOW_DAYS) return '';
  let fg = '#cbd5e1';
  let bg = 'rgba(71,85,105,0.35)';
  let border = 'rgba(148,163,184,0.5)';
  if (days === 0) {
    fg = '#bae6fd'; bg = 'rgba(2,132,199,0.45)'; border = '#38bdf8';
  } else if (days <= 3) {
    fg = '#fde68a'; bg = 'rgba(180,83,9,0.45)'; border = '#f59e0b';
  }
  return '<span class="loop-ws-refill-badge" style="font-size:9px;color:' + fg
    + CSS_BG + bg + ';border:1px solid ' + border
    + ';padding:1px 5px;border-radius:3px;font-weight:700;margin-left:5px;vertical-align:middle;letter-spacing:0.3px;">R '
    + days + 'd</span>';
}

export function resolveStatusPill(
  ws: WorkspaceCredit, config: ReturnType<typeof getWorkspaceLifecycleConfig>,
): { pillHtml: string; suppressTier: boolean } {
  if (!config.enableWorkspaceStatusLabels) return { pillHtml: '', suppressTier: false };
  const wsTier = ws.tier || WsTierValue.FREE;
  const status = getEffectiveStatus(ws, config);
  const pillHtml = buildStatusPillHtml(status, ws);
  let suppressTier = false;
  if (isExpiredTier(wsTier)) {
    const display = classifyFromStatus(status, ws);
    if (display.kind !== 'normal') suppressTier = true;
  }
  return { pillHtml, suppressTier };
}

export function buildLegacyExpiredBadge(ws: WorkspaceCredit): string {
  const days = expiredDays(ws);
  if (days === null) return '';
  const startDate = formatExpiryStartDate(ws);
  const duration = formatExpiredDuration(ws);
  const tipParts = ['Expired'];
  if (startDate) tipParts.push('since ' + startDate);
  if (duration) tipParts.push('(' + duration + ')');
  const tip = tipParts.join(' ').replace(/"/g, '&quot;');
  return '<span style="font-size:10px;color:#fca5a5;background:rgba(127,29,29,0.55);padding:2px 5px;border-radius:3px;font-weight:600;margin-left:3px;vertical-align:middle;" data-marco-tip="' + tip + '">·' + days + 'd</span>';
}

export function resolveTierBadgeLabel(ws: WorkspaceCredit, fallback: string): string {
  const label = formatPlanDisplayLabel(ws.plan);
  return label || fallback;
}

export function buildTierBadgeHtml(ws: WorkspaceCredit): string {
  const wsTier = ws.tier || WsTierValue.FREE;
  const tierMeta = WS_TIER_LABELS[wsTier] || WS_TIER_LABELS[WsTierValue.FREE];
  const config = getWorkspaceLifecycleConfig();
  const { pillHtml: statusPillHtml, suppressTier: suppressTierBadge } = resolveStatusPill(ws, config);
  const tierLabel = resolveTierBadgeLabel(ws, tierMeta.label);

  let tierBadge = suppressTierBadge
    ? ''
    : '<span style="font-size:10px;color:' + tierMeta.fg + CSS_BG + tierMeta.bg + ';padding:2px 5px;border-radius:3px;font-weight:700;margin-left:6px;vertical-align:middle;letter-spacing:0.3px;">' + tierLabel + '</span>';

  if (config.enableWorkspaceStatusLabels) {
    tierBadge += statusPillHtml;
  } else if (isExpiredTier(wsTier)) {
    tierBadge += buildLegacyExpiredBadge(ws);
  }
  if (!config.enableWorkspaceStatusLabels) {
    tierBadge += buildRefillBadgeHtml(ws);
  }
  return tierBadge;
}
