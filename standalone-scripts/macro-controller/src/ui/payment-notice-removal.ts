/**
 * Payment notice removal for MacroController injection.
 *
 * The dedicated `payment-banner-hider` standalone script may not be present in
 * every injection path. When MacroController is injected, this module performs
 * a local pass and keeps watching SPA re-renders for Lovable payment notices.
 */

import { logDebug, logError } from '../error-utils';

const KNOWN_PAYMENT_NOTICE_XPATH = '/html/body/div[2]/main/div/div[1]';
const REMOVED_ATTR = 'data-marco-payment-notice-removed';
const MACRO_PANEL_ID = 'ahk-loop-container';
const MAX_NOTICE_TEXT_LENGTH = 320;
const CANDIDATE_SELECTOR = 'div,section,aside,header,footer,nav,[role="alert"],[role="status"]';

interface PaymentBannerHiderApi {
  check(): void;
}

interface PaymentBannerHiderWindow extends Window {
  PaymentBannerHider?: PaymentBannerHiderApi;
}

let paymentNoticeObserver: MutationObserver | null = null;
let installRequested = false;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function matchesPaymentNoticeText(text: string): boolean {
  const normalized = normalizeText(text);

  return normalized.includes('payment issue detected') || normalized.includes('payment notice');
}

function isHTMLElement(node: Node | null): node is HTMLElement {
  if (node === null) {
    return false;
  }

  return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement;
}

function isMacroElement(element: HTMLElement): boolean {
  if (element.id === MACRO_PANEL_ID) {
    return true;
  }

  return element.closest('#' + MACRO_PANEL_ID) !== null;
}

function isCompactPaymentNotice(element: HTMLElement): boolean {
  if (isMacroElement(element)) {
    return false;
  }

  const text = element.textContent ?? '';
  if (text.length > MAX_NOTICE_TEXT_LENGTH) {
    return false;
  }

  return matchesPaymentNoticeText(text);
}

function resolveNoticeRoot(element: HTMLElement): HTMLElement {
  let root = element;
  let parent = element.parentElement;

  while (parent !== null && parent !== document.body && parent !== document.documentElement) {
    if (!isCompactPaymentNotice(parent)) {
      break;
    }

    root = parent;
    parent = parent.parentElement;
  }

  return root;
}

function locateKnownXpathNotice(): HTMLElement | null {
  if (typeof document.evaluate !== 'function') {
    return null;
  }

  const result = document.evaluate(KNOWN_PAYMENT_NOTICE_XPATH, document, null, 9, null);
  const node = result.singleNodeValue;

  if (!isHTMLElement(node) || !isCompactPaymentNotice(node)) {
    return null;
  }

  return node;
}

function locatePaymentNotices(): HTMLElement[] {
  const matches = new Set<HTMLElement>();
  const known = locateKnownXpathNotice();
  if (known !== null) {
    matches.add(known);
  }

  const candidates = Array.from(document.querySelectorAll(CANDIDATE_SELECTOR));
  for (const candidate of candidates) {
    if (!isHTMLElement(candidate) || !isCompactPaymentNotice(candidate)) {
      continue;
    }

    matches.add(resolveNoticeRoot(candidate));
  }

  return Array.from(matches);
}

function hidePaymentNotice(element: HTMLElement): boolean {
  if (element.getAttribute(REMOVED_ATTR) === 'true') {
    return false;
  }

  element.setAttribute(REMOVED_ATTR, 'true');
  element.setAttribute('aria-hidden', 'true');
  element.hidden = true;
  element.style.setProperty('display', 'none', 'important');

  return true;
}

function runExistingPaymentBannerHider(): void {
  try {
    const api = (window as PaymentBannerHiderWindow).PaymentBannerHider;
    if (api && typeof api.check === 'function') {
      api.check();
    }
  } catch (caught: CaughtError) {
    logError('PaymentNoticeRemoval.existingHider', 'Existing payment banner hider check failed', caught);
  }
}

export function removePaymentNoticeOnce(): number {
  try {
    runExistingPaymentBannerHider();
    let hiddenCount = 0;
    for (const notice of locatePaymentNotices()) {
      if (hidePaymentNotice(notice)) {
        hiddenCount++;
      }
    }

    if (hiddenCount > 0) {
      logDebug('PaymentNoticeRemoval.removeOnce', 'Removed payment notice elements: ' + hiddenCount);
    }

    return hiddenCount;
  } catch (caught: CaughtError) {
    logError('PaymentNoticeRemoval.removeOnce', 'Payment notice removal failed', caught);

    return 0;
  }
}

export function stopPaymentNoticeRemoval(): void {
  if (paymentNoticeObserver !== null) {
    paymentNoticeObserver.disconnect();
    paymentNoticeObserver = null;
  }
}

function startPaymentNoticeObserver(): void {
  removePaymentNoticeOnce();

  if (paymentNoticeObserver !== null || typeof MutationObserver === 'undefined') {
    return;
  }

  const root = document.body ?? document.documentElement;
  paymentNoticeObserver = new MutationObserver(function (): void {
    removePaymentNoticeOnce();
  });
  paymentNoticeObserver.observe(root, { childList: true, subtree: true, characterData: true });
  window.addEventListener('pagehide', stopPaymentNoticeRemoval, { once: true });
}

export function installPaymentNoticeRemoval(): void {
  if (installRequested) {
    removePaymentNoticeOnce();

    return;
  }

  installRequested = true;

  if (document.body) {
    startPaymentNoticeObserver();

    return;
  }

  document.addEventListener('DOMContentLoaded', startPaymentNoticeObserver, { once: true });
}