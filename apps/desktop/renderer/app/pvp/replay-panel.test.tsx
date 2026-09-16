import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PvpDuelRow, PvpFilmView } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';
import type { PvpFilmState } from '../../lib/pvp/use-pvp-film';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
});

const filmState = vi.hoisted((): { current: PvpFilmState } => ({ current: { status: 'idle', view: null } }));

vi.mock('../../lib/pvp/use-pvp-film', () => ({
  usePvpFilm: () => filmState.current,
}));

const { ReplayPanel, roundAxisMax } = await import('./replay-panel');

const ROW: PvpDuelRow = {
  id: 1,
  recordedAt: '2026-09-16T10:00:00.000Z',
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
};

function view(overrides: Partial<PvpFilmView['facts']> = {}): PvpFilmView {
  const series = Array.from({ length: 61 }, (_, second) => ({
    second,
    attackerDamage: Math.min(second, 40) * 4608,
    defenderDamage: Math.min(second, 40) * 3799,
    roomHp: Math.max(0.04, 1 - second * 0.024),
  }));
  return {
    filmId: 48117,
    series,
    facts: {
      leadTakenAtSecond: 3,
      widestLead: { amount: 32360, atSecond: 40 },
      roomHpLeft: 0.04,
      bombs: { attacker: 12, defender: 9 },
      heroes: { attacker: 5, defender: 4 },
      frames: 721,
      hz: 12,
      seconds: 60,
      ...overrides,
    },
  };
}

function render(state: PvpFilmState, filmId: number | null = 48117): string {
  filmState.current = state;
  return renderToStaticMarkup(createElement(ReplayPanel, { filmId, row: ROW, onClose: () => undefined }));
}

describe('ReplayPanel', () => {
  it('draws nothing with no film open', () => {
    expect(render({ status: 'idle', view: null }, null)).toBe('');
  });

  it('shows the panel with a loading note and the close control while the film is read', () => {
    const html = render({ status: 'loading', view: null });
    expect(html).toContain('data-testid="pvp-replay" data-state="loading" data-film-id="48117"');
    expect(html).toContain(en.pvpReplayTitle);
    expect(html).toContain(en.pvpReplayLoading);
    expect(html).toContain('data-testid="pvp-replay-close"');
    expect(html).toContain(en.pvpReplayClose);
    expect(html).not.toContain('data-testid="pvp-replay-chart"');
  });

  it('says the film is not held when main has nothing for it', () => {
    const html = render({ status: 'missing', view: null });
    expect(html).toContain('data-state="missing"');
    expect(html).toContain(en.pvpReplayMissing);
    expect(html).not.toContain('data-testid="pvp-replay-facts"');
  });

  it('names the opponent, the film and its sampling in the header note once the film is read', () => {
    const html = render({ status: 'ready', view: view() });
    expect(html).toContain('Corvo Negro, film 48117, 721 frames at 12 Hz');
  });

  it('prints the four facts: the lead taken, the widest lead signed and dated, the room HP as a percent, and the bombs per side', () => {
    const html = render({ status: 'ready', view: view() });
    expect(html).toContain('data-testid="pvp-replay-facts"');
    expect(html).toMatch(/data-testid="pvp-replay-lead-taken".*?>3 s</);
    expect(html).toMatch(/data-testid="pvp-replay-widest-lead".*?text-up[^>]*>\+32,360 <span[^>]*>at 40 s</);
    expect(html).toMatch(/data-testid="pvp-replay-room-hp".*?>4%</);
    expect(html).toMatch(/data-testid="pvp-replay-bombs".*?>12 vs 9</);
  });

  it('says the lead was never taken, and tones a defender-held widest lead down', () => {
    const html = render({ status: 'ready', view: view({ leadTakenAtSecond: null, widestLead: { amount: -900, atSecond: 7 } }) });
    expect(html).toMatch(new RegExp(`data-testid="pvp-replay-lead-taken".*?>${en.pvpReplayLeadTakenNever}<`));
    expect(html).toMatch(/data-testid="pvp-replay-widest-lead".*?text-down[^>]*>-900 </);
  });

  it('draws the chart with dashed hairlines at zero, half and a rounded top, three lines in the up, down and muted tones, and end dots', () => {
    const html = render({ status: 'ready', view: view() });
    expect(html).toContain('data-testid="pvp-replay-chart" viewBox="0 0 560 150" width="100%"');
    expect(html).toContain('>0</text>');
    expect(html).toContain('>100,000</text>');
    expect(html).toContain('>200,000</text>');
    expect(html).toContain('>0 s</text>');
    expect(html).toContain('>30 s</text>');
    expect(html).toContain('>60 s</text>');
    expect(html).toMatch(/<polyline class="text-up" stroke="currentColor" points="[^"]+" data-series="attacker">/);
    expect(html).toMatch(/<polyline class="text-down" stroke="currentColor" points="[^"]+" data-series="defender">/);
    expect(html).toMatch(/<polyline class="text-muted" stroke="currentColor" stroke-dasharray="4 3" points="[^"]+" data-series="room-hp">/);
    expect(html.match(/<circle /g)).toHaveLength(3);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it('closes the legend with both totals and the room HP entry', () => {
    const html = render({ status: 'ready', view: view() });
    expect(html).toMatch(/data-testid="pvp-replay-legend-you".*?you 184,320</);
    expect(html).toMatch(/data-testid="pvp-replay-legend-opponent".*?Corvo Negro 151,960</);
    expect(html).toContain(en.pvpReplayLegendRoomHp);
  });
});

describe('roundAxisMax', () => {
  it('rounds a total up to its leading digit, and holds a unit axis for no damage', () => {
    expect(roundAxisMax(184320)).toBe(200000);
    expect(roundAxisMax(2400)).toBe(3000);
    expect(roundAxisMax(1000)).toBe(1000);
    expect(roundAxisMax(7)).toBe(7);
    expect(roundAxisMax(0)).toBe(1);
  });
});
