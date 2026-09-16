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

// A static render runs no effects, so the refresh the screen asks for on open is a no-op here;
// the reader's own tests prove what the call does.
vi.mock('../../lib/pvp/use-pvp-history', () => ({
  usePvpHistory: () => historyState.current,
  refreshPvpStanding: () => undefined,
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

function ready(rows: PvpDuelRow[], extra: Partial<Pick<PvpHistoryResult, 'standing' | 'rank'>> = {}): PvpHistoryState {
  const history: PvpHistoryResult = {
    rows,
    totals: { duels: rows.length, won: rows.filter((r) => r.won).length, films: rows.filter((r) => r.filmStored).length },
    standing: null,
    rank: null,
    ...extra,
  };
  return { status: 'ready', applied: 1, history };
}

const STANDING = {
  points: 205,
  tier: 'r2',
  tierNumber: 2,
  nextTierAt: 375,
  tierFloor: 50,
  duelsUsed: 8,
  duelsMax: 10,
  slots: 9,
  slotsMax: 9,
  squadHeroIds: ['862212'],
  capturedAt: new Date(Date.now() - 60_000).toISOString(),
};

describe('PvpView', () => {
  it('shows the empty state before any duel, and while the list is still loading', () => {
    for (const state of [ready([]), { status: 'loading', applied: 0, history: null } as PvpHistoryState]) {
      const html = render(state);
      expect(html).toContain('data-testid="pvp-view"');
      expect(html).toContain(en.pvpEmptyTitle);
      expect(html).not.toContain('data-testid="pvp-duel-row"');
    }
  });

  it('prints one row per duel with the opponent, both scores, the room phase against the tier floor and the points move, and no prize column', () => {
    const html = render(ready([row()]));
    expect(html).toContain('data-testid="pvp-duel-row"');
    expect(html).toContain('Corvo Negro');
    expect(html).toContain('4 heroes');
    expect(html).toContain(en.pvpResultWon);
    expect(html).toContain('184,320 vs 151,960');
    expect(html).toContain('120 (T3, floor 100)');
    expect(html).toContain('118 → 123');
    expect(html).toContain('>+5<');
    expect(html).not.toContain('data-testid="pvp-prize"');
    expect(html).toContain(en.pvpFilmStored);
    expect(html).toContain('1 duels · 1 won · 1 films kept');
  });

  it('draws the standing as fact tiles: the tier as a number, points over the next threshold, duels left, squad slots and the rank', () => {
    const html = render(ready([row()], { standing: STANDING, rank: { position: 2, points: 200, capturedAt: STANDING.capturedAt } }));
    expect(html).toContain('data-testid="pvp-standing" data-state="read"');
    expect(html).toContain('data-testid="pvp-standing-tier"');
    expect(html).toContain('>2</p>');
    expect(html).toContain('205 / 375');
    expect(html).toContain('2 of 10');
    expect(html).toContain('9 of 9');
    expect(html).toContain('>#2</p>');
    expect(html).not.toContain('r2');
  });

  it('falls back to the latest duel for the quota before any state report, and says the rest is not read yet', () => {
    const html = render(ready([row()]));
    expect(html).toContain('data-testid="pvp-standing" data-state="empty"');
    expect(html).toContain('3 of 5');
    expect(html).toContain(en.pvpStandingUnknown);
  });

  it('offers an opponent filter listing every opponent fought, a result filter and the shown-of-total count, with no rivalry until an opponent is chosen', () => {
    const html = render(ready([row(), row({ id: 2, defender: { name: 'Silent', heroes: 8, score: 1 } })]));
    expect(html).toContain('data-testid="pvp-filters"');
    expect(html).toContain(en.pvpFilterOpponentAll);
    expect(html).toContain(en.pvpFilterResultAll);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toMatch(/data-testid="pvp-filter-count"[^>]*>2 of 2</);
    expect(html).not.toContain('data-testid="pvp-head-to-head"');
  });

  it('says nothing has been read with no state, no rank and no duel', () => {
    expect(render(ready([]))).toContain(en.pvpStandingEmpty);
  });

  it('keeps a duel whose film never arrived as a row, and says the film is not kept', () => {
    const html = render(ready([row({ id: 2, filmId: 0, filmStored: false, won: false, prize: 'lost', pointsAfter: 108 })]));
    expect(html).toContain('data-film-stored="false"');
    expect(html).toContain(en.pvpFilmMissing);
    expect(html).toContain(en.pvpResultLost);
    expect(html).toContain('>-10<');
    expect(html).toContain(en.pvpFilmNote);
  });

  it('lists the rows in the order the history serves them — newest first', () => {
    const html = render(ready([row({ id: 9, defender: { name: 'Newest', heroes: 5, score: 1 } }), row({ id: 8, defender: { name: 'Older', heroes: 5, score: 1 } })]));
    expect(html.indexOf('Newest')).toBeLessThan(html.indexOf('Older'));
  });
});
