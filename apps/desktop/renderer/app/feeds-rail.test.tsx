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

const { FeedsRail, feedWords, ringGeometry, ringMotion, refreshAllFill } = await import('./feeds-rail');

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
    // The reason itself is the tooltip's note — see feedWords below; a closed tooltip renders nothing.
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

describe("ringMotion — the ring drains on the browser's clock, so the rail never ticks at rest", () => {
  it('runs the whole cycle as one animation, started the age already spent in', () => {
    expect(ringMotion(feed({ id: 'account', capturedAt: ago(40_000) }), NOW)).toEqual({ kind: 'drain', cycleMs: 60_000, spentMs: 40_000 });
    expect(ringMotion(feed({ id: 'market', capturedAt: ago(20 * 60_000) }), NOW)).toEqual({ kind: 'drain', cycleMs: 15 * 60_000, spentMs: 15 * 60_000 });
  });

  it('a feed with no clock, or never read, has no drain to run', () => {
    expect(ringMotion(feed({ id: 'pvp' }), NOW)).toEqual({ kind: 'step' });
    expect(ringMotion(feed({ id: 'updates', capturedAt: null }), NOW)).toEqual({ kind: 'step' });
  });

  it('the rendered arc carries the cycle as its duration and the age as a negative delay — no timer in React', () => {
    const arc = ringOf(render(), 'account-refresh');
    expect(arc).toContain('animation-name:feed-drain');
    expect(arc).toContain('animation-duration:60000ms');
    expect(arc).toMatch(/animation-delay:-40\d{3}ms/);
    expect(ringOf(render(), 'feeds-refresh-all')).not.toContain('animation-name');
  });
});

describe('feedWords — the tooltip: the name with the last read beside it, the click line with the countdown, what the feed is, and a note when something is wrong', () => {
  it('a feed with a clock: its name, the last read, the click line with the countdown, its cycle, and no note', () => {
    expect(feedWords(feed({ id: 'market', capturedAt: ago(5 * 60_000) }), en, NOW)).toEqual({
      title: en.feedsPrices,
      status: sub(en.feedsLastRead, { age: en.ageMinutes.replace('{n}', '5') }),
      action: en.feedsClickToUpdate,
      next: sub(en.feedsNextIn, { age: sub(en.ageShortMinutes, { n: 10 }) }),
      what: `${en.feedsWhatPrices} · ${sub(en.feedsEvery, { cycle: sub(en.feedsCycleMinutes, { n: 15 }) })}`,
      note: null,
    });
  });

  it("the account's clock is a minute, and a due refresh is said to be due", () => {
    const words = feedWords(feed({ id: 'account', capturedAt: ago(90_000) }), en, NOW);
    expect(words.next).toBe(en.feedsNextDue);
    expect(words.what).toContain(sub(en.feedsEvery, { cycle: sub(en.feedsCycleMinutes, { n: 1 }) }));
  });

  it('the PVP standing has no clock, so no countdown beside the click line', () => {
    const words = feedWords(feed({ id: 'pvp' }), en, NOW);
    expect(words.next).toBeNull();
    expect(words.what).toBe(`${en.feedsWhatPvp} · ${en.feedsNoClock}`);
  });

  it('a feed never read says so where the last read would be, and has no countdown yet', () => {
    const words = feedWords(feed({ id: 'updates', capturedAt: null }), en, NOW);
    expect(words.status).toBe(en.feedsNeverRead);
    expect(words.next).toBeNull();
    expect(words.action).toBe(en.feedsClickToUpdate);
  });

  it('a refusal is the note; out of date is the note; a running read is the status and has no click line', () => {
    expect(feedWords(feed({ id: 'pvp', readState: { kind: 'refused', reason: 'rate_limited' } }), en, NOW).note).toBe(en.accountReadRecent);
    expect(feedWords(feed({ id: 'account', outOfDate: true }), en, NOW).note).toBe(en.feedsOutOfDate);
    const reading = feedWords(feed({ id: 'account', readState: { kind: 'working' } }), en, NOW);
    expect(reading.status).toBe(en.feedsReadingNow);
    expect(reading.action).toBeNull();
  });
});
