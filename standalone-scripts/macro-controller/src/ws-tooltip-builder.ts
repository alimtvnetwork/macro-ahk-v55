import type { WorkspaceCredit } from './types';
import { WsTierValueType } from './types/subscription-status';
import { calcTotalCredits } from './credit-api';
import {
  isExpiredWs,
  formatExpiryStartDate,
  formatExpiredDuration,
} from './credit-fetch';

function buildTooltipProfileLines(ws: WorkspaceCredit): string[] {
  const lines: string[] = ['🪪 PROFILE:'];
  lines.push('  PlanTierType: ' + (ws.planType || ws.tier || WsTierValueType.FREE));
  lines.push('  Role: ' + (ws.membershipRole || ws.role || 'N/A'));
  if (typeof ws.numProjects === 'number' && ws.numProjects > 0) {
    lines.push('  Projects: ' + ws.numProjects);
  }
  lines.push('  Git Sync: ' + (ws.gitSyncEnabled ? 'enabled' : 'disabled'));
  if (ws.subscriptionStatus) lines.push('  Subscription Status: ' + ws.subscriptionStatus);
  if (ws.subscriptionStatusChangedAt) {
    const days = (function () {
      const t = Date.parse(ws.subscriptionStatusChangedAt);
      if (!Number.isFinite(t)) return 0;
      const diff = Date.now() - t;

      return diff > 0 ? Math.floor(diff / 86_400_000) : 0;
    })();
    const suffix = days > 0 ? ' (' + days + 'd ago)' : '';
    lines.push('  Status Changed: ' + ws.subscriptionStatusChangedAt + suffix);
  }
  if (ws.nextRefillAt) lines.push('  Next Refill: ' + ws.nextRefillAt);
  if (ws.billingPeriodEndAt) lines.push('  Billing Period Ends: ' + ws.billingPeriodEndAt);
  if (ws.createdAt) lines.push('  Created: ' + ws.createdAt);

  return lines;
}

function buildTooltipCalculatedLines(ws: WorkspaceCredit): string[] {
  const lines: string[] = ['📊 CALCULATED:'];
  lines.push('  🆓 Daily Free: ' + (ws.dailyFree || 0) + ' (' + ws.dailyLimit + ' - ' + ws.dailyUsed + ')');
  lines.push('  🔄 Rollover: ' + (ws.rollover || 0) + ' (' + ws.rolloverLimit + ' - ' + ws.rolloverUsed + ')');
  lines.push('  💰 Available: ' + (ws.available || 0) + ' (total:' + (ws.totalCredits || 0) + ' - rUsed:' + (ws.rolloverUsed || 0) + ' - dUsed:' + (ws.dailyUsed || 0) + ' - bUsed:' + (ws.used || 0) + ')');
  lines.push('  📦 Billing Only: ' + (ws.billingAvailable || 0) + ' (' + ws.limit + ' - ' + ws.used + ')');
  const _tc = ws.totalCredits ?? calcTotalCredits(ws.freeGranted, ws.dailyLimit, ws.limit, ws.topupLimit, ws.rolloverLimit, ws.plan);
  lines.push('  ⚡ Total Credits: ' + _tc + ' (granted:' + (ws.freeGranted || 0) + ' + daily:' + (ws.dailyLimit || 0) + ' + billing:' + (ws.limit || 0) + ' + topup:' + (ws.topupLimit || 0) + ' + rollover:' + (ws.rolloverLimit || 0) + ')');

  return lines;
}

function buildTooltipRawLines(ws: WorkspaceCredit): string[] {
  const lines: string[] = ['📋 RAW DATA:'];
  lines.push('  ID: ' + ws.id);
  lines.push('  Billing: ' + ws.used + '/' + ws.limit + ' used');
  lines.push('  Rollover: ' + ws.rolloverUsed + '/' + ws.rolloverLimit + ' used');
  lines.push('  Daily: ' + ws.dailyUsed + '/' + ws.dailyLimit + ' used');
  if (ws.freeGranted > 0) lines.push('  Trial: ' + ws.freeRemaining + '/' + ws.freeGranted + ' remaining');
  lines.push('  Status: ' + (ws.subscriptionStatus || 'N/A'));
  if (isExpiredWs(ws)) {
    const startDate = formatExpiryStartDate(ws);
    const duration = formatExpiredDuration(ws);
    if (startDate || duration) {
      const datePart = startDate || 'unknown date';
      const durPart = duration ? ' (' + duration + ')' : '';
      lines.push('  Expired since: ' + datePart + durPart);
    }
  }
  if (ws.raw) {
    const r = ws.raw;
    if (r.last_trial_credit_period) lines.push('  Trial Period: ' + r.last_trial_credit_period);
    if (r.subscription_status) lines.push('  Subscription: ' + r.subscription_status);
  }

  return lines;
}

export function buildLoopTooltipText(ws: WorkspaceCredit): string {
  const lines: string[] = ['━━━ ' + (ws.fullName || ws.name) + ' ━━━', ''];
  lines.push(...buildTooltipProfileLines(ws));
  lines.push('');
  lines.push(...buildTooltipCalculatedLines(ws));
  lines.push('');
  lines.push(...buildTooltipRawLines(ws));

  return lines.join('\n');
}
