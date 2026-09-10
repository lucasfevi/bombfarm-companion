import { describe, expect, it } from 'vitest';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import {
  abilityFilterOptions,
  filterRosterRows,
  pressAbilityFilter,
  rosterRowsShown,
  sortRosterRows,
  toggleAbilityFilter,
  DEFAULT_ROSTER_BOARD_SORT,
  EMPTY_ROSTER_BOARD_FILTER,
} from './roster-board-order';
import type { RosterHeroRow } from './roster-rows';

function row(
  id: string,
  hero: Partial<HeroRecord> & Pick<HeroRecord, 'name'>,
  mean?: number,
): RosterHeroRow {
  const full = {
    rarity: 'Raro',
    level: 50,
    stars: 0,
    abilities: {},
    ...hero,
    id,
  } as HeroRecord;
  return { id, hero: full, report: mean === undefined ? undefined : ({ mean } as never) };
}

describe('sortRosterRows', () => {
  it('orders by power, best first, when descending', () => {
    const rows = [
      row('a', { name: 'A', power: 100 }),
      row('b', { name: 'B', power: 900 }),
      row('c', { name: 'C', power: 500 }),
    ];
    expect(sortRosterRows(rows, { key: 'power', direction: 'desc' }).map((r) => r.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(sortRosterRows(rows, { key: 'power', direction: 'asc' }).map((r) => r.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('sorts an unknown figure LAST in both directions, never as the smallest', () => {
    // The discriminating case: a hero whose power the account has not carried is an absence of
    // evidence. Ranking it as the weakest hero would be a claim the read never made.
    const rows = [
      row('known-low', { name: 'A', power: 1 }),
      row('unknown', { name: 'B' }),
      row('known-high', { name: 'C', power: 9 }),
    ];
    expect(sortRosterRows(rows, { key: 'power', direction: 'desc' }).map((r) => r.id)).toEqual([
      'known-high',
      'known-low',
      'unknown',
    ]);
    expect(sortRosterRows(rows, { key: 'power', direction: 'asc' }).map((r) => r.id)).toEqual([
      'known-low',
      'known-high',
      'unknown',
    ]);
  });

  it('orders rank by the letter ladder, not alphabetically', () => {
    // Alphabetical would put A before S and B before E; the ladder is E D C B A S.
    const rows = [
      row('s', { name: 'S', rank: 'S' }),
      row('a', { name: 'A', rank: 'A' }),
      row('e', { name: 'E', rank: 'E' }),
    ];
    expect(sortRosterRows(rows, { key: 'rank', direction: 'desc' }).map((r) => r.id)).toEqual([
      's',
      'a',
      'e',
    ]);
  });

  it('orders rarity by the game ladder rather than by name', () => {
    const rows = [
      row('c', { name: 'C', rarity: 'Comum' }),
      row('m', { name: 'M', rarity: 'Mítico' }),
      row('r', { name: 'R', rarity: 'Raro' }),
    ];
    expect(sortRosterRows(rows, { key: 'rarity', direction: 'desc' }).map((r) => r.id)).toEqual([
      'm',
      'r',
      'c',
    ]);
  });

  it('breaks every tie by id, so the same roster always lists in the same order', () => {
    // Rarity has six values and stars four, so ties are the common case, not the edge one.
    const rows = [
      row('zeta', { name: 'Z', stars: 2 }),
      row('alpha', { name: 'A', stars: 2 }),
      row('mid', { name: 'M', stars: 2 }),
    ];
    const once = sortRosterRows(rows, { key: 'stars', direction: 'desc' }).map((r) => r.id);
    const twice = sortRosterRows([...rows].reverse(), { key: 'stars', direction: 'desc' }).map(
      (r) => r.id,
    );
    expect(once).toEqual(['alpha', 'mid', 'zeta']);
    expect(twice).toEqual(once);
  });

  it('leaves the caller\'s array untouched', () => {
    const rows = [row('b', { name: 'B', level: 2 }), row('a', { name: 'A', level: 9 })];
    sortRosterRows(rows, { key: 'level', direction: 'desc' });
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('defaults to best birth roll first, which is the order the rail already uses', () => {
    const rows = [row('low', { name: 'L' }, 30), row('high', { name: 'H' }, 70)];
    expect(sortRosterRows(rows, DEFAULT_ROSTER_BOARD_SORT).map((r) => r.id)).toEqual(['high', 'low']);
  });
});

describe('filterRosterRows', () => {
  const roster = [
    row('keen', { name: 'Keen', abilities: { olho_clinico: 5 } }),
    row('brutal', { name: 'Brutal', abilities: { golpe_brutal: 20 } }),
    row('both', { name: 'Both', abilities: { olho_clinico: 3, golpe_brutal: 3 } }),
    row('none', { name: 'None', abilities: {}, battleAllowed: false }),
  ];

  it('keeps every hero when nothing is selected', () => {
    expect(filterRosterRows(roster, EMPTY_ROSTER_BOARD_FILTER)).toHaveLength(4);
  });

  it('narrows to heroes owning ANY of the selected abilities, not all of them', () => {
    // A hero owns at most six of twenty, so ALL would answer nothing for almost every pair and
    // read as a broken control.
    const shown = filterRosterRows(roster, {
      abilityIds: ['olho_clinico', 'golpe_brutal'],
      activeOnly: false,
    });
    expect(shown.map((r) => r.id)).toEqual(['keen', 'brutal', 'both']);
  });

  it('narrows to one ability', () => {
    const shown = filterRosterRows(roster, { abilityIds: ['golpe_brutal'], activeOnly: false });
    expect(shown.map((r) => r.id)).toEqual(['brutal', 'both']);
  });

  it('drops heroes taken out of the rotation when asked', () => {
    const shown = filterRosterRows(roster, { abilityIds: [], activeOnly: true });
    expect(shown.map((r) => r.id)).toEqual(['keen', 'brutal', 'both']);
  });

  it('treats an unset battleAllowed as in the rotation, never as disabled', () => {
    // Absence means the read has not said; dropping those would hide most of a roster.
    const unset = [row('quiet', { name: 'Quiet', abilities: {} })];
    expect(filterRosterRows(unset, { abilityIds: [], activeOnly: true })).toHaveLength(1);
  });

  it('applies both narrowings together', () => {
    const disabledKeen = [
      row('on', { name: 'On', abilities: { olho_clinico: 1 } }),
      row('off', { name: 'Off', abilities: { olho_clinico: 1 }, battleAllowed: false }),
    ];
    const shown = filterRosterRows(disabledKeen, {
      abilityIds: ['olho_clinico'],
      activeOnly: true,
    });
    expect(shown.map((r) => r.id)).toEqual(['on']);
  });
});

describe('abilityFilterOptions', () => {
  const roster = [row('a', { name: 'A', abilities: { olho_clinico: 5, veia_ouro: 0 } })];

  it('lists every ability in the game, not only the ones this roster owns', () => {
    const options = abilityFilterOptions(roster, []);
    expect(options.length).toBeGreaterThan(15);
    expect(options.some((option) => option.id === 'golpe_brutal')).toBe(true);
  });

  it('marks an ability the roster owns, and one it does not', () => {
    const options = abilityFilterOptions(roster, []);
    expect(options.find((option) => option.id === 'olho_clinico')?.owned).toBe(true);
    expect(options.find((option) => option.id === 'golpe_brutal')?.owned).toBe(false);
  });

  it('counts an unspent slot as owned — the hero has it, at level zero', () => {
    expect(abilityFilterOptions(roster, []).find((o) => o.id === 'veia_ouro')?.owned).toBe(true);
  });

  it('marks the selected ones', () => {
    const options = abilityFilterOptions(roster, ['golpe_brutal']);
    expect(options.find((option) => option.id === 'golpe_brutal')?.selected).toBe(true);
    expect(options.find((option) => option.id === 'olho_clinico')?.selected).toBe(false);
  });
});

describe('toggleAbilityFilter', () => {
  it('adds one that was not selected and removes one that was', () => {
    expect(toggleAbilityFilter([], 'a')).toEqual(['a']);
    expect(toggleAbilityFilter(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('returns to where it started after two presses', () => {
    expect(toggleAbilityFilter(toggleAbilityFilter(['b'], 'a'), 'a')).toEqual(['b']);
  });
});

describe('pressAbilityFilter', () => {
  it('toggles a tile the roster owns, exactly as pressing it should', () => {
    expect(pressAbilityFilter([], { id: 'a', owned: true, selected: false })).toEqual(['a']);
    expect(pressAbilityFilter(['a', 'b'], { id: 'a', owned: true, selected: true })).toEqual(['b']);
  });

  it('refuses a tile no hero on this roster owns, which would filter the roster down to nothing', () => {
    // The discriminating case, and the reason this is not `toggleAbilityFilter` at the call site:
    // the tile stays pressable in the DOM (its tooltip needs hover, so it cannot be `disabled`),
    // and selecting an unowned ability leaves a roster of zero heroes and a dimmed tile as the
    // only way back.
    expect(pressAbilityFilter([], { id: 'nobody-owns-it', owned: false, selected: false })).toEqual(
      [],
    );
  });

  it('returns the selection UNCHANGED on a refusal, so a re-render is not provoked either', () => {
    const selected = ['a'];
    expect(pressAbilityFilter(selected, { id: 'z', owned: false, selected: false })).toBe(selected);
  });

  it('still takes a refused ability back OUT if one was somehow selected', () => {
    // Belt and braces on the shape of the guard: it must not become "unowned means untouchable",
    // which would strand a selection made before the roster changed under it.
    expect(pressAbilityFilter(['z'], { id: 'z', owned: false, selected: true })).toEqual(['z']);
  });
});

describe('rosterRowsShown', () => {
  it('narrows first, then orders what survived', () => {
    const rows = [
      row('weak-keen', { name: 'W', power: 10, abilities: { olho_clinico: 1 } }),
      row('strong-other', { name: 'S', power: 999, abilities: { golpe_brutal: 1 } }),
      row('mid-keen', { name: 'M', power: 500, abilities: { olho_clinico: 1 } }),
    ];
    const shown = rosterRowsShown(
      rows,
      { abilityIds: ['olho_clinico'], activeOnly: false },
      { key: 'power', direction: 'desc' },
    );
    // The strongest hero is filtered out, so it cannot lead the board it is not on.
    expect(shown.map((r) => r.id)).toEqual(['mid-keen', 'weak-keen']);
  });
});
