import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveEarnings } from '@bombfarm/contracts';
import type { ReachedLiveFreshness } from './freshness-line';
import { EarningsPanel } from './earnings-panel';

const LIVE: ReachedLiveFreshness = { kind: 'live' };
const GAP: ReachedLiveFreshness = {
  kind: 'gap',
  reason: 'detached',
  actionable: true,
  sinceAt: new Date(Date.now() - 2 * 60_000).toISOString(),
};

function earnings(overrides: Partial<LiveEarnings> = {}): LiveEarnings {
  return {
    goldBalance: 12_345,
    gold10: 100_000,
    goldSession: 90_000,
    xp10: 5_000,
    xpSession: 4_500,
    coverageSeconds: 120,
    sessionSeconds: 300,
    ...overrides,
  };
}

function html(data: LiveEarnings | null, freshness: ReachedLiveFreshness = LIVE) {
  return renderToStaticMarkup(createElement(EarningsPanel, { freshness, earnings: data, onReset: () => undefined }));
}

/** Reads the text content of the one element carrying `data-testid="{testId}"`, regardless of
 *  what else is on the tag (class, other attributes) or their order. */
function cellText(out: string, testId: string): string {
  const match = out.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`));
  if (!match) throw new Error(`no element with data-testid="${testId}" found in:\n${out}`);
  return match[1] ?? '';
}

describe('EarningsPanel — every cell in every state', () => {
  it('with figures: the current balance and every rate render, rates carrying the /h suffix', () => {
    const out = html(earnings());

    expect(cellText(out, 'live-earnings-gold-current')).toBe('12.3k');
    expect(cellText(out, 'live-earnings-gold-10')).toBe('100k/h');
    expect(cellText(out, 'live-earnings-gold-session')).toBe('90k/h');
    expect(cellText(out, 'live-earnings-xp-10')).toBe('5k/h');
    expect(cellText(out, 'live-earnings-xp-session')).toBe('4.5k/h');
    expect(cellText(out, 'live-earnings-xp-current')).toBe('—');
  });

  it('no data at all: every rate/balance position is an em dash, never 0', () => {
    const out = html(null, GAP);

    for (const testId of [
      'live-earnings-gold-current',
      'live-earnings-gold-10',
      'live-earnings-gold-session',
      'live-earnings-xp-current',
      'live-earnings-xp-10',
      'live-earnings-xp-session',
    ]) {
      expect(cellText(out, testId)).toBe('—');
    }
  });

  it('a null carried on only some fields still renders an em dash for exactly those, real numbers for the rest', () => {
    const out = html(earnings({ gold10: null, xpSession: null }));

    expect(cellText(out, 'live-earnings-gold-10')).toBe('—');
    expect(cellText(out, 'live-earnings-xp-session')).toBe('—');
    expect(cellText(out, 'live-earnings-gold-session')).toBe('90k/h');
    expect(cellText(out, 'live-earnings-xp-10')).toBe('5k/h');
  });

  it('the XP row current cell is a literal em dash in every state — there is no account-level XP total', () => {
    for (const data of [earnings(), null]) {
      expect(cellText(html(data), 'live-earnings-xp-current')).toBe('—');
    }
  });
});

describe('EarningsPanel — the coverage label states its true span, never a claimed 10 minutes it does not have', () => {
  it.each([
    [15, 1],
    [59, 1],
    [125, 2],
    [600, 10],
    [700, 10],
  ])('coverageSeconds=%d renders "Last %d min"', (coverageSeconds, minutes) => {
    const out = html(earnings({ coverageSeconds }));
    expect(cellText(out, 'live-earnings-column-recent')).toBe(`Last ${String(minutes)} min`);
  });
});

describe('EarningsPanel — current gold and its age', () => {
  it('live: shows the tick balance, with no age attached', () => {
    const out = html(earnings({ goldBalance: 42 }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
  });

  it('stale: shows the last known balance together with a rendered age', () => {
    const out = html(earnings({ goldBalance: 42 }), GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42 · 2m ago');
  });

  it('no data: an em dash, never a stale reading pinned to a fabricated age', () => {
    const out = html(null, GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('—');
  });
});

describe('EarningsPanel — session duration and reset live in the header', () => {
  it('formats sessionSeconds with the shared live-duration formatter', () => {
    const out = html(earnings({ sessionSeconds: 90 }));
    expect(cellText(out, 'live-earnings-session-duration')).toBe('Session 1:30');
  });

  it('renders 0:00 rather than throwing before any tick has arrived', () => {
    const out = html(null);
    expect(cellText(out, 'live-earnings-session-duration')).toBe('Session 0:00');
  });

  it('renders a real reset button', () => {
    const out = html(earnings());
    expect(out).toMatch(/<button[^>]*data-testid="live-earnings-reset"/);
  });
});
