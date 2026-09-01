import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../../lib/copy/en';
import type { LiveFastModel, LiveSlowModel } from '../../lib/live/live-model';
import { EMPTY_LIVE_FAST_MODEL } from '../../lib/live/live-model';
import { MiniHeroes } from './mini-heroes';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return {
    ...actual,
    useCopy: () => en,
    useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }),
  };
});

const SLOW: LiveSlowModel = {
  onField: [{ id: 'hero-a', name: 'Astra', energyFraction: 0.42 }],
  recovering: [{ id: 'hero-b', name: 'Blaze', energyFraction: 0.8 }],
  queued: [],
  benched: [],
  unclassifiedCount: 0,
  fieldExitPendingCount: 0,
  occupancy: { occupied: 1, fieldSize: 3 },
  house: { slots: 2, slotsMax: 4 },
};

const FAST: LiveFastModel = {
  field: { 'hero-a': { heroId: 'hero-a', secondsRemaining: 120, basis: 'observed' } },
  recovery: { 'hero-b': { heroId: 'hero-b', secondsRemaining: 45, advancing: true } },
  energy: { 'hero-a': 0.42, 'hero-b': 0.8 },
};

function html(slow: LiveSlowModel | null, fast: LiveFastModel = EMPTY_LIVE_FAST_MODEL): string {
  return renderToStaticMarkup(createElement(MiniHeroes, { slow, fast }));
}

describe('MiniHeroes', () => {
  it('renders an energy bar per on-field and recovering row', () => {
    const out = html(SLOW, FAST);
    expect(out).toContain('data-testid="live-hero-row-hero-a-energy-bar"');
    expect(out).toContain('data-testid="live-hero-row-hero-b-energy-bar"');
  });

  it('keeps the heroes section scrollable', () => {
    const out = html(SLOW, FAST);
    expect(out).toMatch(/data-testid="mini-heroes"[^>]*overflow-auto/);
  });

  it('shows the empty-list copy when there are no rows', () => {
    const out = html({
      ...SLOW,
      onField: [],
      recovering: [],
    });
    expect(out).toContain(en.liveListEmptyLine);
    expect(out).toContain('data-testid="live-hero-list-empty"');
  });
});
