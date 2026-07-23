/**
 * MacroLoop Controller — Auth Module (barrel re-export)
 * Phase 5B: Split into focused sub-modules:
 *   - auth-resolve.ts    (token utils, session bridge, cookie, resolve, persist, badge)
 *   - auth-bridge.ts     (extension bridge, relay health, debug snapshot)
 *   - auth-recovery.ts   (recoverAuthOnce, refreshBearerTokenFromBestSource)
 *
 * This barrel preserves backward compatibility for all existing imports.
 */

// Plan-17 Step 27: pruned barrel to remove dead re-exports (symbols with
// zero consumers outside their source module: authRecoveryManager,
// extractTokenFromAuthBridgeResponse, getRawToken, getTokenAge,
// getTokenSavedAt, isRelayActive, saveTokenWithTimestamp,
// normalizeBearerToken, isJwtToken, isUsableToken, extractBearerTokenFromUnknown).
// The source modules retain the exports; only the re-export is dropped.
export {
  getLastTokenSource,
  setLastTokenSource,
  getBearerTokenFromSessionBridge,
  getSessionCookieNames,
  getBearerTokenFromCookie,
  persistResolvedBearerToken,
  updateAuthBadge,
  resolveToken,
  markBearerTokenExpired,
  invalidateSessionBridgeKey,
} from './auth-resolve';

export {
  getLastBridgeOutcome,
  getAuthDebugSnapshot,
  requestTokenFromExtension,
  wakeBridge,
} from './auth-bridge';

export type { AuthDebugSnapshot } from './auth-bridge';

export {
  setRecordRefreshOutcome,
  recoverAuthOnce,
  refreshBearerTokenFromBestSource,
  getBearerToken,
} from './auth-recovery';

export type { RefreshTokenOptions, GetBearerTokenOptions } from './auth-recovery';
