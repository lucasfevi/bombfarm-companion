import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../lib/copy/en';
import { sub } from '../lib/copy';
import type { FeedView, RefreshAllState } from '../lib/feeds/use-feeds';

vi.mock('../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/copy')>();
  return { ...actual, useCopy: () => en };
});

const { FeedsRail, feedWords, ringGeometry, refreshAllFill } = await import('./feeds-rail');

const NOW = Date.now();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function feed(overrides: Partial<FeedView> & { id: FeedView['id'] }): FeedView {
  return { capturedAt: ago(40_000), outOfDate: false, busy: false, readState: { kind: 'idle' }, request: () => {}, ...overrides };
}

const FRESH: FeedView[] = [
  feed({ id: 'account' }),
  feed({ id: 'pvp', capturedAt: ago(3 * 60_000) }),
  feed({ id: 'market', capturedAt: ago(4 * 60_000) }),
  feed({ id: 'updates', capturedAt: ago(12 * 60_000) }),
];

function render(feeds: FeedView[] = FRESH, all: RefreshAllState = { running: false }, activeTabId = 'farm'): string {
  return renderToStaticMarkup(createElement(FeedsRail, { feeds, refreshAll: () => {}, all, activeTabId }));
}

function tagOf(html: string, testId: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
}

function ringOf(html: string, testId: string): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  return html.slice(start, html.indexOf('</svg>', start));
}

describe('ringGeometry — the ring is the time left on the feed\'s clock, and its state', () => {
  it('is full the moment a read lands and drains to empty as the clock runs down', () => {
    expect(ringGeometry(feed({ id: 'account', capturedAt: ago(0) }), NOW)).toEqual({ state: 'fresh', left: 1 });
    expect(ringGeometry(feed({ id: 'account', capturedAt: ago(30_000) }), NOW)).toEqual({ state: 'fresh', left: 0.5 });
    expect(ringGeometry(feed({ id: 'account', capturedAt: ago(90_000) }), NOW)).toEqual({ state: 'fresh', left: 0 });
  });

  it('has no arc for a feed with no clock, and none for one never read', () => {
    expect(ringGeometry(feed({ id: 'pvp' }), NOW)).toEqual({ state: 'noclock', left: null });
    expect(ringGeometry(feed({ id: 'market', capturedAt: null }), NOW)).toEqual({ state: 'never', left: null });
  });

  it('a press in flight, or a screen recomputing, is working whatever the clock says', () => {
    expect(ringGeometry(feed({ id: 'account', readState: { kind: 'working' } }), NOW).state).toBe('working');
    expect(ringGeometry(feed({ id: 'account', busy: true }), NOW).state).toBe('working');
  });

  it('"out of date" outranks a refusal, and a refusal outranks the clock', () => {
    expect(ringGeometry(feed({ id: 'account', outOfDate: true, readState: { kind: 'refused', reason: 'offline' } }), NOW).state).toBe('late');
    expect(ringGeometry(feed({ id: 'account', readState: { kind: 'refused', reason: 'offline' } }), NOW).state).toBe('refused');
  });
});

describe('FeedsRail — four rings beside four names, and one ring for all of them', () => {
  it('draws the feeds in press order, each as its own button with a ring and no figure', () => {
    const html = render();
    const order = ['account-refresh', 'feed-pvp-refresh', 'feed-market-refresh', 'feed-updates-refresh'].map((id) => html.indexOf(`data-testid="${id}"`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toContain(en.ageJustNow);
    expect(html).not.toContain(en.ageMinutes.replace('{n}', '3'));
    expect(ringOf(html, 'account-refresh')).toContain('data-ring="fresh"');
    expect(ringOf(html, 'feed-pvp-refresh')).toContain('data-ring="noclock"');
  });

  it('the account item speaks for a screen computed from an older copy: the warn ring with a filled centre', () => {
    const html = render([feed({ id: 'account', outOfDate: true }), ...FRESH.slice(1)]);
    expect(tagOf(html, 'account-refresh')).toContain('data-state="late"');
    expect(ringOf(html, 'account-refresh')).toContain('stroke-warn');
    expect(ringOf(html, 'account-refresh')).toContain('fill-warn');
  });

  it('a refused press is a grey ring and the one word, muted — its reason is the tooltip\'s; the item stays pressable', () => {
    const html = render([feed({ id: 'account', readState: { kind: 'refused', reason: 'game_not_running' } }), ...FRESH.slice(1)]);
    expect(tagOf(html, 'account-refresh')).toContain('data-state="refused"');
    expect(tagOf(html, 'account-refresh')).not.toContain('disabled=""');
    expect(html).toContain(`data-testid="feed-account-word"`);
    expect(html).toContain(en.feedsRefused);
    // The reason itself is the tooltip's last sentence — see feedWords below; a closed tooltip renders nothing.
    expect(ringOf(html, 'account-refresh')).not.toContain('stroke-warn');
  });

  it('a working press spins the ring in the accent and is not pressable again', () => {
    const html = render([feed({ id: 'account' }), feed({ id: 'pvp', readState: { kind: 'working' } }), ...FRESH.slice(2)]);
    expect(tagOf(html, 'feed-pvp-refresh')).toContain('disabled=""');
    expect(tagOf(html, 'feed-pvp-refresh')).toContain('data-state="working"');
    expect(ringOf(html, 'feed-pvp-refresh')).toContain('animate-spin');
    expect(ringOf(html, 'feed-pvp-refresh')).toContain('stroke-accent');
  });

  it('the feeds the tab on show does not read are muted; the ones it reads are not', () => {
    const farm = render(FRESH, { running: false }, 'farm');
    expect(tagOf(farm, 'account-refresh')).toContain('data-muted="false"');
    expect(tagOf(farm, 'feed-pvp-refresh')).toContain('data-muted="true"');
    const inventory = render(FRESH, { running: false }, 'inventory');
    expect(tagOf(inventory, 'feed-market-refresh')).toContain('data-muted="false"');
    const pvp = render(FRESH, { running: false }, 'pvp');
    expect(tagOf(pvp, 'feed-pvp-refresh')).toContain('data-muted="false"');
    expect(tagOf(pvp, 'account-refresh')).toContain('data-muted="true"');
    const settings = render(FRESH, { running: false }, 'settings');
    expect(tagOf(settings, 'feed-updates-refresh')).toContain('data-muted="false"');
  });

  it('while refresh-all runs, the steps still to come are muted, the button counts the steps, and its ring fills a quarter per step', () => {
    const html = render(FRESH, { running: true, step: 1, total: 4 }, 'skills');
    expect(tagOf(html, 'feed-market-refresh')).toContain('data-muted="true"');
    expect(tagOf(html, 'feed-updates-refresh')).toContain('data-muted="true"');
    expect(html).toContain(sub(en.feedsRefreshAllStep, { step: 2, total: 4 }));
    expect(tagOf(html, 'feeds-refresh-all')).toContain('disabled=""');
    expect(refreshAllFill({ running: true, step: 1, total: 4 })).toBe(0.375);
    expect(refreshAllFill({ running: false })).toBe(0);
  });

  it('every press is named by the design-system tooltip, never the native attribute', () => {
    const html = render();
    expect(html).not.toContain(' title=');
    expect(tagOf(html, 'feed-market-refresh')).toContain('data-slot="tooltip-trigger"');
  });
});

describe('feedWords — the tooltip says what the feed is, where it stands, how it keeps fresh, and what a click does', () => {
  it('a feed with a clock: its name, what it is, the last read, its cycle with the countdown, and the click line', () => {
    expect(feedWords(feed({ id: 'market', capturedAt: ago(5 * 60_000) }), en, NOW)).toEqual({
      title: en.feedsPrices,
      lines: [
        en.feedsWhatPrices,
        sub(en.feedsLastRead, { age: en.ageMinutes.replace('{n}', '5') }),
        sub(en.feedsEvery, { cycle: sub(en.feedsCycleMinutes, { n: 15 }), age: sub(en.ageShortMinutes, { n: 10 }) }),
      ],
      action: en.feedsClickToUpdate,
    });
  });

  it("the account's clock is a minute, and a due refresh is said to be due", () => {
    const words = feedWords(feed({ id: 'account', capturedAt: ago(90_000) }), en, NOW);
    expect(words.lines[2]).toBe(sub(en.feedsEveryDue, { cycle: sub(en.feedsCycleMinutes, { n: 1 }) }));
  });

  it('the PVP standing says it has no clock of its own', () => {
    expect(feedWords(feed({ id: 'pvp' }), en, NOW).lines[2]).toBe(en.feedsNoClock);
  });

  it('a feed never read says so in words, and its cycle without a countdown', () => {
    const words = feedWords(feed({ id: 'updates', capturedAt: null }), en, NOW);
    expect(words.lines[1]).toBe(en.feedsNeverRead);
    expect(words.lines[2]).toBe(sub(en.feedsEveryUnread, { cycle: sub(en.feedsCycleMinutes, { n: 20 }) }));
    expect(words.action).toBe(en.feedsClickToUpdate);
  });

  it('a refusal adds its reason as the last line; out of date is a sentence; a running read has no click line', () => {
    expect(feedWords(feed({ id: 'pvp', readState: { kind: 'refused', reason: 'rate_limited' } }), en, NOW).lines.at(-1)).toBe(en.accountReadRecent);
    expect(feedWords(feed({ id: 'account', outOfDate: true }), en, NOW).lines[1]).toBe(en.feedsOutOfDate);
    const reading = feedWords(feed({ id: 'account', readState: { kind: 'working' } }), en, NOW);
    expect(reading.lines[1]).toBe(en.feedsReadingNow);
    expect(reading.action).toBeNull();
  });
});
