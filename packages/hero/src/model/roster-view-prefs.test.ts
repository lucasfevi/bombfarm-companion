import { describe, expect, it } from 'vitest';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { DEFAULT_LEADERBOARD_SORT, DEFAULT_LEADERBOARD_VIEW } from './roster-leaderboard';
import type { RosterHeroRow } from './roster-rows';
import {
  DEFAULT_ROSTER_VIEW_PREFS,
  normalizeRosterViewPrefs,
  ownedRosterBoardFilter,
  type RosterViewPrefs,
} from './roster-view-prefs';

function row(id: string, abilities: HeroRecord['abilities']): RosterHeroRow {
  const hero = { name: id, rarity: 'Raro', level: 50, stars: 0, abilities, id } as HeroRecord;
  return { id, hero, report: undefined };
}

const CHOSEN: RosterViewPrefs = {
  viewMode: 'table',
  sort: { key: 'level', direction: 'asc' },
  filter: { abilityIds: ['olho_clinico'], activeOnly: true },
  leaderboardView: {
    sort: { column: 'critDmg', direction: 'asc' },
    filter: 'squad',
    hiddenColumns: ['energy', 'luck'],
  },
  showcaseView: { showLevels: true },
};

describe('normalizeRosterViewPrefs', () => {
  it('reads back everything a player chose, through a JSON round-trip', () => {
    expect(normalizeRosterViewPrefs(JSON.parse(JSON.stringify(CHOSEN)))).toEqual(CHOSEN);
  });

  it.each([null, undefined, 'table', 7, []])('reads %j as the defaults', (value) => {
    expect(normalizeRosterViewPrefs(value)).toEqual(DEFAULT_ROSTER_VIEW_PREFS);
  });

  it('falls back field by field, keeping every field it recognises', () => {
    const read = normalizeRosterViewPrefs({ ...CHOSEN, viewMode: 'grid', sort: { key: 'charm', direction: 'asc' } });
    expect(read.viewMode).toBe(DEFAULT_ROSTER_VIEW_PREFS.viewMode);
    expect(read.sort).toEqual(DEFAULT_ROSTER_VIEW_PREFS.sort);
    expect(read.filter).toEqual(CHOSEN.filter);
    expect(read.leaderboardView).toEqual(CHOSEN.leaderboardView);
    expect(read.showcaseView).toEqual(CHOSEN.showcaseView);
  });

  it('drops abilities the game does not have, and duplicates', () => {
    const read = normalizeRosterViewPrefs({
      filter: { abilityIds: ['olho_clinico', 'no_such_ability', 'olho_clinico', 3] },
    });
    expect(read.filter).toEqual({ abilityIds: ['olho_clinico'], activeOnly: false });
  });

  it('never restores the table sorted by a column it also restores hidden', () => {
    const read = normalizeRosterViewPrefs({
      leaderboardView: { sort: { column: 'luck', direction: 'desc' }, filter: 'everyone', hiddenColumns: ['luck'] },
    });
    expect(read.leaderboardView.hiddenColumns).toEqual(['luck']);
    expect(read.leaderboardView.sort).toEqual(DEFAULT_LEADERBOARD_SORT);
  });

  it("keeps the table's default hidden columns when none were stored, and never hides the name", () => {
    expect(normalizeRosterViewPrefs({ leaderboardView: { filter: 'bench' } }).leaderboardView.hiddenColumns).toEqual(
      DEFAULT_LEADERBOARD_VIEW.hiddenColumns,
    );
    expect(
      normalizeRosterViewPrefs({ leaderboardView: { hiddenColumns: ['name', 'position', 'cdr'] } }).leaderboardView
        .hiddenColumns,
    ).toEqual(['cdr']);
  });
});

describe('ownedRosterBoardFilter', () => {
  const rows = [row('keen', { olho_clinico: 5 }), row('plain', {})];

  it('drops a remembered ability no hero on this roster owns, so it cannot empty the roster', () => {
    expect(ownedRosterBoardFilter(rows, { abilityIds: ['olho_clinico', 'golpe_brutal'], activeOnly: true })).toEqual({
      abilityIds: ['olho_clinico'],
      activeOnly: true,
    });
  });

  it('returns the very same filter when every ability is owned', () => {
    const filter = { abilityIds: ['olho_clinico'], activeOnly: false };
    expect(ownedRosterBoardFilter(rows, filter)).toBe(filter);
  });
});
