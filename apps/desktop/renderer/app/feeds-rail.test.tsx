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

const { FeedsRail, feedWords } = await import('./feeds-rail');

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

function render(feeds: FeedView[] = FRESH, all: RefreshAllState = { running: false }): string {
  return renderToStaticMarkup(createElement(FeedsRail, { feeds, refreshAll: () => {}, all }));
}

function tagOf(html: string, testId: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
}

function textOf(html: string, testId: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? '';
}

describe('FeedsRail — four names over four ages, and one press for all of them', () => {
  it('draws the feeds in press order, each as its own button', () => {
    const html = render();
    const order = ['account-refresh', 'feed-pvp-refresh', 'feed-market-refresh', 'feed-updates-refresh'].map((id) => html.indexOf(`data-testid="${id}"`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('data-testid="feeds-refresh-all"');
  });

  it('prints each age in the mono figure, and "not yet" for a feed never read', () => {
    const html = render([...FRESH.slice(0, 3), feed({ id: 'updates', capturedAt: null })]);
    expect(textOf(html, 'account-refresh-age')).toBe(en.ageJustNow);
    expect(textOf(html, 'feed-pvp-age')).toBe(en.ageMinutes.replace('{n}', '3'));
    expect(textOf(html, 'feed-updates-age')).toBe(en.feedsNotYet);
  });

  it('the account item speaks for a screen computed from an older copy: "out of date", in the warn tone', () => {
    const html = render([feed({ id: 'account', outOfDate: true }), ...FRESH.slice(1)]);
    expect(textOf(html, 'account-refresh-age')).toBe(en.farmRefreshStale);
    expect(tagOf(html, 'account-refresh')).toContain('data-state="late"');
  });

  it('a refused press prints its reason in the age\'s place, and the item stays pressable', () => {
    const html = render([feed({ id: 'account', readState: { kind: 'refused', reason: 'game_not_running' } }), ...FRESH.slice(1)]);
    expect(textOf(html, 'account-refresh-age')).toBe(en.accountReadGameNotRunning);
    expect(tagOf(html, 'account-refresh')).not.toContain('disabled=""');
  });

  it('a working press reads as reading, is not pressable again, and fills its meter', () => {
    const html = render([feed({ id: 'account' }), feed({ id: 'pvp', readState: { kind: 'working' } }), ...FRESH.slice(2)]);
    expect(textOf(html, 'feed-pvp-age')).toBe(en.feedsReading);
    expect(tagOf(html, 'feed-pvp-refresh')).toContain('disabled=""');
    expect(tagOf(html, 'feed-pvp-refresh')).toContain('data-state="working"');
  });

  it('while refresh-all runs, the steps still to come are dimmed and the button counts the steps', () => {
    const html = render(FRESH, { running: true, step: 1, total: 4 });
    expect(tagOf(html, 'account-refresh')).not.toContain('opacity-55');
    expect(tagOf(html, 'feed-pvp-refresh')).not.toContain('opacity-55');
    expect(tagOf(html, 'feed-market-refresh')).toContain('opacity-55');
    expect(tagOf(html, 'feed-updates-refresh')).toContain('opacity-55');
    expect(textOf(html, 'feeds-refresh-all-step')).toBe(sub(en.feedsRefreshAllStep, { step: 2, total: 4 }));
    expect(tagOf(html, 'feeds-refresh-all')).toContain('disabled=""');
  });

  it('every press is named by the design-system tooltip, never the native attribute', () => {
    const html = render();
    expect(html).not.toContain(' title=');
    expect(tagOf(html, 'feed-market-refresh')).toContain('data-slot="tooltip-trigger"');
  });
});

describe('feedWords — the tooltip says how the feed keeps itself fresh', () => {
  it('a feed with a clock says its cycle and how long until the next automatic refresh', () => {
    const words = feedWords(feed({ id: 'market', capturedAt: ago(5 * 60_000) }), en, NOW);
    expect(words.tip[0]).toBe(sub(en.feedsRefreshOne, { feed: en.feedsPrices }));
    expect(words.tip[1]).toBe(sub(en.feedsEvery, { cycle: sub(en.feedsCycleMinutes, { n: 15 }) }));
    expect(words.tip[2]).toBe(sub(en.feedsNextIn, { age: sub(en.ageShortMinutes, { n: 10 }) }));
  });

  it("the account's cycle is a minute, and a due refresh is said to be due", () => {
    const words = feedWords(feed({ id: 'account', capturedAt: ago(90_000) }), en, NOW);
    expect(words.tip[1]).toBe(sub(en.feedsEvery, { cycle: sub(en.feedsCycleMinutes, { n: 1 }) }));
    expect(words.tip[2]).toBe(en.feedsNextDue);
  });

  it('the PVP standing says it has no clock of its own, and nothing about a next refresh', () => {
    const words = feedWords(feed({ id: 'pvp' }), en, NOW);
    expect(words.tip).toEqual([sub(en.feedsRefreshOne, { feed: en.feedsPvp }), en.feedsNoClock]);
  });

  it('an age past the feed\'s own limit is late; a fresh one is not', () => {
    expect(feedWords(feed({ id: 'market', capturedAt: ago(31 * 60_000) }), en, NOW).late).toBe(true);
    expect(feedWords(feed({ id: 'market', capturedAt: ago(14 * 60_000) }), en, NOW).late).toBe(false);
  });
});
