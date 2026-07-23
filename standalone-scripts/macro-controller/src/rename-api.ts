/**
 * MacroLoop Controller — Single Workspace Rename API
 *
 * Sends PUT /user/workspaces/:id with bearer auth, automatic
 * fallback for credit-limit field (403), auth recovery (401),
 * and rate-limit retry (429).
 *
 * v7.40: Migrated from raw fetch() to httpRequest() (XMLHttpRequest + Promise).
 * v7.50: Migrated to marco.api centralized SDK (Axios + registry).
 *
 * @see spec/22-app-issues/55-workspace-api-missing-bearer-token.md
 * @see memory/architecture/networking/centralized-api-registry
 */

import { log, logSub } from './logger';
import { resolveToken, recoverAuthOnce, invalidateSessionBridgeKey } from './auth';

import { showDiagnosticToast } from './errors/show-diagnostic-toast';
import { CREDIT_API_BASE } from './shared-state';
import { hasForbidden, addForbidden, removeForbidden } from './rename-forbidden-cache';
import { getAuthRecoveryExhausted, setAuthRecoveryExhausted } from './rename-auth-recovery-flag';
import type { RenameStrategy } from './types';
import { delay } from './async-utils';
import { logError } from './error-utils';
import { ApiPath } from './types';
import { throwDiagnostic, DiagnosticError } from './errors/diagnostic-error';

// ============================================
// Types
// ============================================

interface SdkApiResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly data: unknown;
  readonly headers: Record<string, string>;
}

interface RenameAttemptState {
  readonly includeCreditLimit: boolean;
  readonly didAuthRecovery: boolean;
  readonly didLimitFallback: boolean;
  readonly didRateLimitRetry: boolean;
}

const INITIAL_ATTEMPT: RenameAttemptState = {
  includeCreditLimit: true,
  didAuthRecovery: false,
  didLimitFallback: false,
  didRateLimitRetry: false,
};

// ============================================
// Helpers
// ============================================

function getStrategy(attempt: RenameAttemptState): RenameStrategy {
  if (attempt.didAuthRecovery) {
    return 'auth-retry';
  }

  if (attempt.didLimitFallback) {
    return 'no-limit';
  }

  if (attempt.didRateLimitRetry) {
    return 'rate-retry';
  }

  return 'normal';
}

function buildLabels(attempt: RenameAttemptState): string {
  const labels: string[] = [];

  if (attempt.didLimitFallback) {
    labels.push('no-limit');
  }

  if (attempt.didAuthRecovery) {
    labels.push('auth-retry');
  }

  if (attempt.didRateLimitRetry) {
    labels.push('rate-retry');
  }

  return labels.length > 0 ? ' (' + labels.join(', ') + ')' : '';
}

function buildRenameBody(newName: string, includeCreditLimit: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: newName };

  if (includeCreditLimit) {
    payload.default_monthly_member_credit_limit = -1;
  }

  return payload;
}

// ============================================
// Token failure
// ============================================

function rejectNoBearerToken(wsId: string): Error {
  const err = new DiagnosticError('RENAME_NO_BEARER_E001', { wsId });
  logError('Rename', 'No bearer token available for rename request — request blocked (wsId=' + wsId + ')');
  // plan 22 gap #7 migration: emit the structured toast (title/body/next-fix/code)
  // via the single sink instead of a hand-crafted showToast() string so severity,
  // human template, and footerCode stay in the error registry (never duplicated).
  showDiagnosticToast(err, {
    noStop: true,
    requestDetail: { method: 'PUT', url: ApiPath.UserWorkspacesSlash + wsId },
  });
  return err;
}


// ============================================
// Response handlers
// ============================================

function handleCreditLimitFallback(
  resp: SdkApiResponse,
  wsId: string,
): void {
  const bodyPreview = JSON.stringify(resp.data).substring(0, 500);
  log('[Rename] 403 with default_monthly_member_credit_limit — retrying without limit field', 'warn');
  // plan 22 gap #7 migration: structured warn toast + registry-driven copy.
  const err = new DiagnosticError('RENAME_CREDIT_LIMIT_FALLBACK_E001', {
    wsId,
    status: resp.status,
    bodyPreview,
  });
  showDiagnosticToast(err, {
    requestDetail: {
      method: 'PUT',
      url: ApiPath.UserWorkspacesSlash + wsId,
      status: resp.status,
      responseBody: bodyPreview,
    },
  });
}

async function handleRenameAuthRecovery(
  token: string,
  wsId: string,
): Promise<string | null> {
  const isExhausted = getAuthRecoveryExhausted();

  if (isExhausted) {
    log('[Rename] Auth recovery already exhausted in this batch — skipping', 'warn');

    return null;
  }

  const invalidatedKey = invalidateSessionBridgeKey(token);
  log('[Rename] Got 401 — invalidated "' + invalidatedKey + '", recovering auth...', 'warn');
  // plan 22 gap #7 migration: structured warn toast for the 401-recovery path.
  const err = new DiagnosticError('RENAME_AUTH_RECOVERY_E001', { wsId });
  showDiagnosticToast(err, {
    requestDetail: { method: 'PUT', url: ApiPath.UserWorkspacesSlash + wsId, status: 401 },
  });

  try {
    const recoveredToken = await recoverAuthOnce();
    const fallbackToken = recoveredToken || resolveToken();

    if (fallbackToken) {
      log('[Rename] Auth recovered — retrying with new token', 'info');

      return fallbackToken;
    }

    log('[Rename] Auth recovery produced no token — marking exhausted for batch', 'warn');
    setAuthRecoveryExhausted(true);

    return null;
  } catch {
    log('[Rename] Auth recovery error — marking exhausted for batch', 'warn');
    setAuthRecoveryExhausted(true);

    return null;
  }
}

function handleRenameError(
  resp: SdkApiResponse,
  wsId: string,
  attempt: RenameAttemptState,
): DiagnosticError {
  const bodyPreview = JSON.stringify(resp.data).substring(0, 500);
  logError('Rename', '❌ HTTP ' + resp.status + ': ' + bodyPreview.substring(0, 200));
  // plan 22 gap #7 migration: build the DiagnosticError once, render it as the
  // structured toast, and return it so the caller throws the same instance.
  // Prevents drift between the toast copy and the thrown error's message.
  const err = new DiagnosticError('RENAME_REQUEST_E001', {
    url: ApiPath.UserWorkspacesSlash + wsId,
    status: resp.status,
    wsId,
  });
  showDiagnosticToast(err, {
    requestDetail: {
      method: 'PUT',
      url: ApiPath.UserWorkspacesSlash + wsId,
      status: resp.status,
      responseBody: bodyPreview,
    },
  });

  const isForbiddenAfterFallback = resp.status === 403 && attempt.didLimitFallback;

  if (isForbiddenAfterFallback) {
    addForbidden(wsId, bodyPreview);
  }

  return err;
}


// ============================================
// Core rename execution via SDK
// ============================================

async function executeRename(
  wsId: string,
  newName: string,
  token: string,
  attempt: RenameAttemptState,
  forceRetry: boolean,
): Promise<RenameStrategy> {
  if (!token) {
    throw rejectNoBearerToken(wsId);
  }

  const labelSuffix = buildLabels(attempt);
  const body = buildRenameBody(newName, attempt.includeCreditLimit);

  log('[Rename] PUT /user/workspaces/' + wsId + ' → "' + newName + '"' + labelSuffix, 'delegate');
  logSub('Auth: Bearer ' + token.substring(0, 12) + '...', 1);

  const resp = await window.marco!.api!.workspace.rename(wsId, newName, {
    baseUrl: CREDIT_API_BASE,
    body,
  });

  // Rate limit retry
  const isRateLimited = resp.status === 429 && !attempt.didRateLimitRetry;

  if (isRateLimited) {
    log('[Rename] Rate limited (429) — retrying in 2s', 'warn');
    await delay(2000);

    return executeRename(wsId, newName, token, { ...attempt, didRateLimitRetry: true }, forceRetry);
  }

  // 403 with credit-limit field → retry without it
  const isCreditLimitForbidden = resp.status === 403 && attempt.includeCreditLimit && !attempt.didLimitFallback;

  if (isCreditLimitForbidden) {
    handleCreditLimitFallback(resp, wsId);

    return executeRename(wsId, newName, token, { ...attempt, includeCreditLimit: false, didLimitFallback: true }, forceRetry);
  }

  // 401 → auth recovery
  const isUnauthorized = resp.status === 401 && !attempt.didAuthRecovery;

  if (isUnauthorized) {
    const newToken = await handleRenameAuthRecovery(token, wsId);

    if (!newToken) {
      throw rejectNoBearerToken(wsId);
    }

    return executeRename(wsId, newName, newToken, { ...attempt, didAuthRecovery: true }, forceRetry);
  }

  // Other errors — handleRenameError already surfaced the structured toast;
  // throw the SAME DiagnosticError instance so the message never drifts.
  if (!resp.ok) {
    throw handleRenameError(resp, wsId, attempt);
  }

  // Success
  const strategy = getStrategy(attempt);
  log('[Rename] ✅ renamed to "' + newName + '"' + (strategy !== 'normal' ? ' [' + strategy + ']' : ''), 'success');

  const wasForcedAndForbidden = forceRetry === true && hasForbidden(wsId);

  if (wasForcedAndForbidden) {
    removeForbidden(wsId);
  }

  return strategy;
}

// ============================================
// renameWorkspace — public entry point
// ============================================

export async function renameWorkspace(wsId: string, newName: string, forceRetry?: boolean): Promise<RenameStrategy> {
  const isCachedForbidden = !forceRetry && hasForbidden(wsId);

  if (isCachedForbidden) {
    log('[Rename] ⛔ Workspace ' + wsId + ' is in forbidden cache, skipping (use force-retry to override)', 'warn');
    throwDiagnostic('RENAME_FORBIDDEN_CACHED_E001', { wsId });
  }

  let token = resolveToken();

  if (!token) {
    log('[Rename] No bearer token — recovering before request', 'warn');

    try {
      const recoveredToken = await recoverAuthOnce();
      token = recoveredToken || resolveToken();
    } catch {
      throw rejectNoBearerToken(wsId);
    }

    if (!token) {
      throw rejectNoBearerToken(wsId);
    }
  }

  return executeRename(wsId, newName, token, INITIAL_ATTEMPT, forceRetry ?? false);
}
