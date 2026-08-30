import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarketPrice, type MarketPriceLabels, type MarketPriceView } from './market-price';

const labels: MarketPriceLabels = {
  amount: (amount, currency) => `${currency} ${amount.toFixed(2)}`,
  title: (price) => `${price.basis} quote, 1 h old`,
  unpriced: (state) => (state === 'no-listing' ? 'No listing' : 'Unknown'),
};

const PRICED: MarketPriceView = {
  state: 'priced',
  amount: 12.5,
  currency: 'USD',
  basis: 'native',
  listingUrl: 'https://steamcommunity.com/market/listings/1/Coal%20Boots',
  quotedUtc: null,
  listings: 4,
};

function render(price: MarketPriceView, action?: Parameters<typeof MarketPrice>[0]['action']) {
  return renderToStaticMarkup(createElement(MarketPrice, { price, labels, action }));
}

describe('MarketPrice', () => {
  it('renders nothing at all for an item the game marks untradable', () => {
    expect(render({ ...PRICED, state: 'not-tradable' })).toBe('');
  });

  it('marks a converted figure with ~ and leaves an exact quote unqualified', () => {
    expect(render({ ...PRICED, basis: 'converted' })).toContain('~');
    expect(render(PRICED)).not.toContain('~');
  });

  it('stands a word in for the number when there is none', () => {
    expect(render({ ...PRICED, state: 'no-listing', amount: null })).toContain('No listing');
  });

  it('keeps the listing link opening in a new tab with an untrusted-target rel', () => {
    const html = render(PRICED);
    expect(html).toContain(`href="${PRICED.listingUrl ?? ''}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders the action slot after the price', () => {
    const html = render(PRICED, createElement('button', { type: 'button', 'aria-label': 'Refresh' }, 'R'));
    expect(html.indexOf('aria-label="Refresh"')).toBeGreaterThan(html.indexOf('href='));
  });

  it('carries the quote detail on the design-system tooltip rather than a native title', () => {
    const html = render(PRICED);
    expect(html).toContain('data-slot="tooltip-trigger"');
    expect(html).not.toMatch(/\stitle="/);
  });
});
