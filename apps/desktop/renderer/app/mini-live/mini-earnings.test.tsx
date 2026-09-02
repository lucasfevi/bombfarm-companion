import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveEarnings } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';
import { MiniEarnings } from './mini-earnings';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return {
    ...actual,
    useCopy: () => en,
    useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }),
  };
});

function earnings(overrides: Partial<LiveEarnings> = {}): LiveEarnings {
  return {
    goldBalance: 12_345,
    goldBalanceCapturedAt: null,
    gold10: 100_000,
    goldSession: 90_000,
    xp10: 5_000,
    xpSession: 4_500,
    goldSessionTotal: 75_000,
    xpSessionTotal: 3_750,
    gold10Series: [90_000, 110_000, 100_000],
    goldPerProp10: 180,
    propsPerMinute10: 110,
    propsSessionTotal: 420,
    coverageSeconds: 120,
    sessionSeconds: 300,
    ...overrides,
  };
}

function html(data: LiveEarnings | null) {
  return renderToStaticMarkup(createElement(MiniEarnings, { earnings: data, onReset: () => undefined }));
}

function hasTestId(markup: string, testId: string): boolean {
  return markup.includes(`data-testid="${testId}"`);
}

describe('MiniEarnings', () => {
  it('keeps the compact earnings testids with a fixture payload', () => {
    const out = html(earnings());
    for (const testId of [
      'live-earnings-gold-10',
      'live-earnings-xp-10',
      'live-earnings-gold-current',
      'live-earnings-gold-session',
      'live-earnings-xp-session',
      'live-earnings-gold-per-prop',
      'live-earnings-props-per-minute',
      'live-earnings-props-total',
      'live-earnings-reset',
    ]) {
      expect(hasTestId(out, testId), testId).toBe(true);
    }
  });

  it('omits sparkline, session totals, elapsed, and vs-estimate surfaces', () => {
    const out = html(earnings());
    expect(hasTestId(out, 'live-earnings-trend')).toBe(false);
    expect(hasTestId(out, 'live-earnings-gold-session-total')).toBe(false);
    expect(hasTestId(out, 'live-earnings-xp-session-total')).toBe(false);
    expect(hasTestId(out, 'live-earnings-elapsed')).toBe(false);
    expect(hasTestId(out, 'live-earnings-gold-per-prop-delta')).toBe(false);
  });

  it('renders em dashes for an empty payload, not zero', () => {
    const out = html(null);
    expect(out).toContain('>—<');
    expect(out).not.toMatch(/data-testid="live-earnings-gold-10"[^>]*>0</);
  });
});
