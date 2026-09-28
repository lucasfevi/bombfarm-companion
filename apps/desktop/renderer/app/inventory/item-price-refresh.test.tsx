// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MarketQuoteResult, MarketQuoteTarget } from '@bombfarm/contracts';
import { ItemPriceRefresh } from './item-price-refresh';

// react-dom/client warns that act() is unsupported unless this is set — matches
// never-read-empty-state-sprite.test.tsx's own established setup.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TARGET: MarketQuoteTarget = { kind: 'key', key: 'ember_luva#2' };

const QUOTED: MarketQuoteResult = {
  ok: true,
  key: 'ember_luva#2',
  hashName: 'Ember Gloves (Legendary)',
  currency: 'BRL',
  amount: 12.5,
  quotedUtc: '2026-09-28T00:00:00.000Z',
};

function deferredQuote() {
  let resolve: (result: MarketQuoteResult) => void = () => undefined;
  const promise = new Promise<MarketQuoteResult>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

let container: HTMLDivElement;
let root: Root;
let onRefresh: ReturnType<typeof vi.fn>;
let quotes: ReturnType<typeof deferredQuote>[];

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  quotes = [];
  onRefresh = vi.fn(() => {
    const next = deferredQuote();
    quotes.push(next);
    return next.promise;
  });

  act(() => {
    root.render(
      <ItemPriceRefresh
        target={TARGET}
        itemName="Ember Gloves"
        label="Refresh the Ember Gloves price"
        onRefresh={onRefresh as (target: MarketQuoteTarget) => Promise<MarketQuoteResult>}
      />,
    );
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function refreshButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('[data-testid="item-price-refresh"]');
  if (!button) throw new Error('no refresh button rendered');
  return button;
}

function press(): void {
  act(() => {
    refreshButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('ItemPriceRefresh', () => {
  it('refuses a second press while the first quote is still in flight', () => {
    press();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    press();
    press();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('marks the in-flight button aria-disabled, and dims it through a variant that matches', () => {
    const idle = refreshButton();
    expect(idle.getAttribute('aria-disabled')).toBe('false');
    expect(idle.className).toMatch(/aria-disabled:opacity-40/);
    expect(idle.className).toMatch(/aria-disabled:cursor-not-allowed/);
    expect(idle.className).not.toMatch(/(^|\s)disabled:/);

    press();
    expect(refreshButton().getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps the in-flight button hoverable, so its tooltip label stays reachable', () => {
    press();
    expect(refreshButton().disabled).toBe(false);
  });

  it('accepts a fresh press once the quote lands', async () => {
    press();
    const first = quotes[0];
    if (!first) throw new Error('the first press asked for no quote');
    await act(async () => {
      first.resolve(QUOTED);
      await first.promise;
    });

    expect(refreshButton().getAttribute('aria-disabled')).toBe('false');
    press();
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });
});
