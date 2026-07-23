import { beforeEach, describe, expect, it, vi } from 'vitest';

import { removePaymentNoticeOnce } from '../ui/payment-notice-removal';

interface TestPaymentBannerHiderWindow extends Window {
  PaymentBannerHider?: { check: () => void };
}

function testWindow(): TestPaymentBannerHiderWindow {
  return window as TestPaymentBannerHiderWindow;
}

describe('MacroController payment notice removal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete testWindow().PaymentBannerHider;
  });

  it('hides a compact payment issue notice when MacroController is injected', () => {
    const notice = document.createElement('div');
    notice.textContent = 'Payment issue detected.';
    document.body.appendChild(notice);

    expect(removePaymentNoticeOnce()).toBe(1);
    expect(notice.getAttribute('data-marco-payment-notice-removed')).toBe('true');
    expect(notice.hidden).toBe(true);
    expect(notice.style.display).toBe('none');
  });

  it('hides the compact notice wrapper instead of only the text child', () => {
    const wrapper = document.createElement('div');
    const child = document.createElement('span');
    child.textContent = 'Payment issue detected.';
    wrapper.appendChild(child);
    document.body.appendChild(wrapper);

    expect(removePaymentNoticeOnce()).toBe(1);
    expect(wrapper.getAttribute('data-marco-payment-notice-removed')).toBe('true');
    expect(child.getAttribute('data-marco-payment-notice-removed')).toBeNull();
  });

  it('does not hide large page containers that merely mention payment text', () => {
    const pageContent = document.createElement('div');
    pageContent.textContent = 'Payment issue detected. ' + 'content '.repeat(80);
    document.body.appendChild(pageContent);

    expect(removePaymentNoticeOnce()).toBe(0);
    expect(pageContent.hidden).toBe(false);
  });

  it('also invokes the dedicated payment-banner-hider API when available', () => {
    const check = vi.fn();
    testWindow().PaymentBannerHider = { check };

    removePaymentNoticeOnce();

    expect(check).toHaveBeenCalledTimes(1);
  });
});