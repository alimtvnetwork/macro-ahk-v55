/*
 * ui/extension-relay.ts
 *
 * Plan-17 step 10 leaf. Owns the low-level "post a request to the
 * background service worker" primitive that used to live in
 * `ui/prompt-loader.ts`.
 *
 * Imports are intentionally minimal: `logging` + `error-utils` only.
 * Do NOT import from `./prompt-loader`, `../toast`, or `./error-overlay`
 * or the cycle returns.
 */

import { log, logSub } from '../logger';
import type { ExtensionResponse } from '../types';

// Minimal ambient chrome shape (module-scoped). The full @types/chrome is not
// bundled with this content-script build; the two APIs we touch here are
// sendMessage (with callback) and lastError. Cast to a typed local so strict
// compilation stays honest without pulling the entire chrome typings surface.
declare const chrome: {
  runtime?: {
    sendMessage?: (message: unknown, callback?: (response: ExtensionResponse) => void) => void;
    lastError?: { message?: string };
  };
};

/** Internal relay-context shape (was RelayCtx in prompt-loader). */
interface RelayCtx {
  settled: boolean;
  requestId: string;
  timeout: ReturnType<typeof setTimeout>;
  resolve: (resp: ExtensionResponse) => void;
  _onResponse?: (event: MessageEvent) => void;
}

function finishRelay(relay: RelayCtx, resp: ExtensionResponse): void {
  if (relay.settled) return;
  relay.settled = true;
  if (relay._onResponse) {
    window.removeEventListener('message', relay._onResponse);
  }
  clearTimeout(relay.timeout);
  relay.resolve(resp);
}

function handleRelayResponse(relay: RelayCtx, event: MessageEvent): void {
  if (event.data && event.data.source === 'marco-extension' && event.data.requestId === relay.requestId) {
    finishRelay(relay, event.data.payload);
  }
}

/**
 * Send a message to the extension via chrome.runtime or window.postMessage relay.
 * Returns a Promise that resolves with the extension response.
 */
export function sendToExtension(type: string, payload: Record<string, unknown>): Promise<ExtensionResponse> {
  return new Promise<ExtensionResponse>(function(resolve) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const message = Object.assign({ type: type }, payload);
        chrome.runtime.sendMessage(message, function(resp: ExtensionResponse) {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            log('Extension message error: ' + (lastError.message || ''), 'warn');
            resolve({ isOk: false, errorMessage: lastError.message || 'runtime error' });
            return;
          }
          resolve(resp);
        });
        return;
      } catch (e) {
        logSub('chrome.runtime.sendMessage unavailable, falling through to relay: ' + (e instanceof Error ? e.message : String(e)), 1);
      }
    }

    // Relay via window.postMessage (content script bridge)
    const requestId = 'pr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

    const relay: RelayCtx = {
      settled: false,
      requestId,
      timeout: setTimeout(function() {
        log('Extension relay timed out for ' + type, 'warn');
        finishRelay(relay, { isOk: false, errorMessage: 'Extension relay timeout' });
      }, 5000),
      resolve,
    };

    relay._onResponse = function(event: MessageEvent) { handleRelayResponse(relay, event); };

    window.addEventListener('message', relay._onResponse);
    window.postMessage({ source: 'marco-controller', requestId: requestId, ...(payload || {}), type: type }, '*');
  });
}
