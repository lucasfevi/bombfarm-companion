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

// The squad column reads the roster through the account seam; a static render never starts that
// store, so the roster is handed in here as the loaded answer.
const roster = vi.hoisted(() => ({ heroes: [] as { id: string; name: string; rarity: string; skin?: number }[] }));

vi.mock('../../lib/account/use-account-view', () => ({
  useAccountView: () => ({ status: 'loaded', view: {}, applied: 1, key: 'account' }),
}));

vi.mock('../../lib/account/account-roster', () => ({
  buildAccountRoster: () => ({ heroes: roster.heroes }),
}));

const { PvpView } = await import('./pvp-view');
const { DuelHistoryPanel } = await import('./duel-history-panel');

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
    expect(html).toMatch(/<button [^>]*data-testid="pvp-open-replay" aria-pressed="false" class="[^"]*border-line bg-bg-2[^"]*"/);
    expect(html).toContain(en.pvpFilmReplay);
    expect(html).not.toContain('data-testid="pvp-replay"');
    expect(html).toContain('1 duels · 1 won · 1 films kept');
  });

  it('draws the open duel Replay as the pressed primary button, and the others as plain ones', () => {
    const history = ready([row()]);
    const html = renderToStaticMarkup(
      createElement(DuelHistoryPanel, {
        history: history.status === 'ready' ? history.history : null,
        openFilmId: 48117,
        onOpenReplay: () => undefined,
      }),
    );
    expect(html).toMatch(/<button [^>]*data-testid="pvp-open-replay" aria-pressed="true" class="[^"]*border-accent bg-accent[^"]*"/);
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

  it('draws the tier meter under the figures: the tier pair, the fill over the next threshold, the ticks, and the wins and days still to go', () => {
    const html = render(ready([row()], { standing: STANDING }));
    expect(html).toContain('data-testid="pvp-tier-meter"');
    expect(html).toContain('Tier 2 to Tier 3');
    expect(html).toMatch(/style="width:\s*54\.6\d+%"/);
    expect(html).toMatch(/data-testid="pvp-tier-eta"[^>]*>.*34 wins.*to go at .*5.* a win, about .*4 days.* at today’s quota/);
    expect(html).toMatch(/>0<\/span><span[^>]*>205<\/span><span>375<\/span>/);
  });

  it('reads the per-win step off the latest won duel, and drops the days clause when the quota is not known', () => {
    const html = render(ready([row({ pointsBefore: 100, pointsAfter: 106 })], { standing: { ...STANDING, duelsMax: null } }));
    expect(html).toMatch(/data-testid="pvp-tier-eta"[^>]*>.*29 wins.*to go at .*6.* a win</);
    expect(html).not.toContain('at today’s quota');
  });

  it('omits the tier meter at the top tier, which has no threshold ahead of it', () => {
    const html = render(ready([row()], { standing: { ...STANDING, nextTierAt: null } }));
    expect(html).toContain('data-testid="pvp-standing" data-state="read"');
    expect(html).not.toContain('data-testid="pvp-tier-meter"');
    expect(html).not.toContain('data-testid="pvp-tier-eta"');
  });

  it('draws the points trend beside the figures over the newest twelve duels, oldest first, with the window, win rate and streak above it', () => {
    const rows = Array.from({ length: 14 }, (_, index) =>
      row({ id: 20 - index, won: index < 2, pointsBefore: 150 - index * 5, pointsAfter: 155 - index * 5 }),
    );
    const html = render(ready(rows, { standing: STANDING }));
    expect(html).toContain('data-testid="pvp-points-trend" data-state="drawn"');
    expect(html).toContain(en.pvpStandingTrendLabel);
    expect(html).toContain('last 12, win rate 17%, streak W2');
    expect(html).toContain('data-sparkline');
    expect(html).toContain('aria-label="Points after each of the last 12 duels"');
    expect(html).toContain('class="block text-accent"');
  });

  it('dots each duel on the trend by its result, newest last, over an axis spanning the readings, with a won/lost legend', () => {
    const html = render(ready([row({ id: 3, won: false, pointsBefore: 120, pointsAfter: 110 }), row({ id: 2 }), row({ id: 1 })]));
    const tones = [...html.matchAll(/data-sparkline-mark="(\w+)"/g)].map((match) => match[1]);
    expect(tones).toEqual(['up', 'up', 'down']);
    expect(html).toContain('class="stroke-down"');
    expect(html).toMatch(/<path d="M0 [\d.]+ L50 [\d.]+ L100 63"[^>]*stroke="currentColor"/);
    expect(html).toContain('data-testid="pvp-points-trend-legend"');
    expect(html).toContain('bg-up');
    expect(html).toContain('bg-down');
    expect(html).toContain(en.pvpStandingLegendWon);
    expect(html).toContain(en.pvpStandingLegendLost);
  });

  it('says a losing streak as one, over the rows it has when fewer than twelve', () => {
    const html = render(ready([row({ id: 3, won: false, pointsBefore: 120, pointsAfter: 110 }), row({ id: 2 }), row({ id: 1 })]));
    expect(html).toContain('last 3, win rate 67%, streak L1');
  });

  it('asks for more duels in place of the trend under two rows', () => {
    const html = render(ready([row()], { standing: STANDING }));
    expect(html).toContain('data-testid="pvp-points-trend" data-state="empty"');
    expect(html).toContain(en.pvpStandingTrendEmpty);
    expect(html).not.toContain('data-sparkline');
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
    const html = render(ready([row({ id: 2, filmId: 0, filmStored: false, won: false, prize: null, pointsAfter: 108 })]));
    expect(html).toContain('data-film-stored="false"');
    expect(html).toContain(en.pvpFilmMissing);
    expect(html).toContain(en.pvpResultLost);
    expect(html).toContain('>-10<');
    expect(html).toContain(en.pvpFilmNote);
  });

  it('draws the squad as one avatar per fielded hero in slot order, keeps a slot for a hero the roster no longer carries, and prints a dash for a row with no squad', () => {
    roster.heroes = [
      { id: '862212', name: 'Nim', rarity: 'Raro', skin: 3 },
      { id: '900001', name: 'Pip', rarity: 'Comum' },
    ];
    try {
      const html = render(ready([row({ squadHeroIds: ['900001', '777', '862212'] }), row({ id: 2, squadHeroIds: [] })]));
      expect(html).toContain(en.pvpSquadColumn);
      expect(html).toContain('data-testid="pvp-squad" data-count="3"');
      expect(html).toContain('data-testid="pvp-squad" data-count="0"');
      expect(html.match(/data-testid="pvp-squad-unknown"/g)).toHaveLength(1);
      expect(html).toContain(`aria-label="${en.pvpSquadUnknownHero}"`);
      expect(html.indexOf('alt="Pip"')).toBeLessThan(html.indexOf('data-testid="pvp-squad-unknown"'));
      expect(html.indexOf('data-testid="pvp-squad-unknown"')).toBeLessThan(html.indexOf('alt="Nim"'));
      // Each hero the roster still carries opens its card; the unknown slot has nothing to open.
      expect(html.match(/data-peek="hero"/g)).toHaveLength(2);
      expect(html).toMatch(/data-testid="pvp-squad" data-count="0"[^>]*><span aria-hidden="true">—<\/span>/);
    } finally {
      roster.heroes = [];
    }
  });

  it('keeps every slot as an unknown hero while the roster is not read', () => {
    const html = render(ready([row({ squadHeroIds: ['1', '2'] })]));
    expect(html).toContain('data-testid="pvp-squad" data-count="2"');
    expect(html.match(/data-testid="pvp-squad-unknown"/g)).toHaveLength(2);
    expect(html).not.toContain('<img');
  });

  it('lists the rows in the order the history serves them — newest first', () => {
    const html = render(ready([row({ id: 9, defender: { name: 'Newest', heroes: 5, score: 1 } }), row({ id: 8, defender: { name: 'Older', heroes: 5, score: 1 } })]));
    expect(html.indexOf('Newest')).toBeLessThan(html.indexOf('Older'));
  });
});
