import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PvpDuelRow, PvpHistoryResult } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';
import type { PvpHistoryState } from '../../lib/pvp/use-pvp-history';

// `useCopy()`/`useLocale()` are hooks over a context this test never mounts a provider for, and
// the history seam reaches a preload bridge that does not exist in a node-environment render.
vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
});

const historyState = vi.hoisted(() => ({ current: null as unknown as PvpHistoryState }));

vi.mock('../../lib/pvp/use-pvp-history', () => ({
  usePvpHistory: () => historyState.current,
}));

const { PvpView } = await import('./pvp-view');

function render(state: PvpHistoryState): string {
  historyState.current = state;
  return renderToStaticMarkup(createElement(PvpView));
}

function row(overrides: Partial<PvpDuelRow> = {}): PvpDuelRow {
  return {
    id: 1,
    recordedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    accountId: '486',
    filmStored: true,
    won: true,
    phase: 120,
    filmId: 48117,
    rooms: 3,
    seconds: 60,
    attacker: { name: 'Player', heroes: 5, score: 184320 },
    defender: { name: 'Corvo Negro', heroes: 4, score: 151960 },
    pointsBefore: 118,
    pointsAfter: 123,
    duelsLeft: 3,
    duelsMax: 5,
    prize: 'won',
    tier: 'r3',
    tierFloor: 100,
    squadHeroIds: [],
    ...overrides,
  };
}

function ready(rows: PvpDuelRow[]): PvpHistoryState {
  const history: PvpHistoryResult = {
    rows,
    totals: { duels: rows.length, won: rows.filter((r) => r.won).length, films: rows.filter((r) => r.filmStored).length },
  };
  return { status: 'ready', applied: 1, history };
}

describe('PvpView', () => {
  it('shows the empty state before any duel, and while the list is still loading', () => {
    for (const state of [ready([]), { status: 'loading', applied: 0, history: null } as PvpHistoryState]) {
      const html = render(state);
      expect(html).toContain('data-testid="pvp-view"');
      expect(html).toContain(en.pvpEmptyTitle);
      expect(html).not.toContain('data-testid="pvp-duel-row"');
    }
  });

  it('prints one row per duel with the opponent, both scores, the room phase against the tier floor, the points move and the prize', () => {
    const html = render(ready([row()]));
    expect(html).toContain('data-testid="pvp-duel-row"');
    expect(html).toContain('Corvo Negro');
    expect(html).toContain('4 heroes');
    expect(html).toContain(en.pvpResultWon);
    expect(html).toContain('184,320 vs 151,960');
    expect(html).toContain('data-testid="pvp-phase">120<');
    expect(html).toContain('tier r3, floor 100');
    expect(html).toContain('118 → 123');
    expect(html).toContain('>+5<');
    expect(html).toContain(en.pvpPrizeWon);
    expect(html).toContain(en.pvpFilmStored);
    expect(html).toContain('1 duels · 1 won · 1 films kept');
    expect(html).toContain('3 of 5 duels left');
  });

  it('keeps a duel whose film never arrived as a row, and says the film is not kept', () => {
    const html = render(ready([row({ id: 2, filmId: 0, filmStored: false, won: false, prize: 'lost', pointsAfter: 108 })]));
    expect(html).toContain('data-film-stored="false"');
    expect(html).toContain(en.pvpFilmMissing);
    expect(html).toContain(en.pvpResultLost);
    expect(html).toContain(en.pvpPrizeLost);
    expect(html).toContain('>-10<');
    expect(html).toContain(en.pvpFilmNote);
  });

  it('lists the rows in the order the history serves them — newest first', () => {
    const html = render(ready([row({ id: 9, defender: { name: 'Newest', heroes: 5, score: 1 } }), row({ id: 8, defender: { name: 'Older', heroes: 5, score: 1 } })]));
    expect(html.indexOf('Newest')).toBeLessThan(html.indexOf('Older'));
  });
});
