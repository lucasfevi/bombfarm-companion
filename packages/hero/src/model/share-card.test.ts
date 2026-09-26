import { describe, expect, it } from 'vitest';
import type { RollQualityReport } from '@bombfarm/domain/roll-quality';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { RosterHeroRow } from './roster-rows';
import { rowFixture } from './showcase.test-fixture';
import {
  EMPTY_SHARE_PICKER_FILTER,
  clampSharePhase,
  defaultShareCardSettings,
  featuredRows,
  filterSharePickerRows,
  initialSharePhase,
  shareCardLayout,
  shareCardTotals,
  shareDpsText,
  sharePickerRarities,
  sharePicksFor,
  shareStars,
  togglePick,
  toggleSharePickerRarity,
} from './share-card';

function row(partial: Partial<HeroRecord> & Pick<HeroRecord, 'id'>, rollMean?: number): RosterHeroRow {
  const base = rowFixture(partial);
  return {
    ...base,
    report: rollMean === undefined ? undefined : ({ mean: rollMean } as unknown as RollQualityReport),
  };
}

const ids = (rows: readonly RosterHeroRow[]) => rows.map((entry) => entry.id);

describe('featuredRows', () => {
  const roster = [
    row({ id: 'a', power: 100 }, 0.9),
    row({ id: 'b', power: 400 }, 0.2),
    row({ id: 'c', power: 300 }, 0.7),
    row({ id: 'd', power: 200 }, 0.8),
  ];

  it('features the three strongest by power, whatever their birth rolls', () => {
    expect(ids(featuredRows(roster))).toEqual(['b', 'c', 'd']);
  });

  it('breaks a power tie by hero id, and puts a hero with no power read last', () => {
    const tied = [row({ id: 'z', power: 50 }), row({ id: 'm' }), row({ id: 'k', power: 50 })];
    expect(ids(featuredRows(tied))).toEqual(['k', 'z', 'm']);
  });

  it('features fewer than three when fewer are picked', () => {
    expect(ids(featuredRows([row({ id: 'solo', power: 1 })]))).toEqual(['solo']);
  });
});

describe('shareCardTotals', () => {
  it('counts and sums only the heroes handed to it', () => {
    const totals = shareCardTotals([
      row({ id: 'a', power: 1000, rarity: 'Mítico' }),
      row({ id: 'b', power: 250, rarity: 'Épico' }),
      row({ id: 'c', rarity: 'Épico' }),
    ]);
    expect(totals.heroCount).toBe(3);
    expect(totals.totalPower).toBe(1250);
  });

  it('counts Mythic, Legendary and Epic in that order, leaving out a tier nobody holds', () => {
    const totals = shareCardTotals([
      row({ id: 'a', rarity: 'Épico' }),
      row({ id: 'b', rarity: 'Mítico' }),
      row({ id: 'c', rarity: 'Épico' }),
      row({ id: 'd', rarity: 'Raro' }),
    ]);
    expect(totals.tierCounts).toEqual([
      { rarity: 'Mítico', count: 1 },
      { rarity: 'Épico', count: 2 },
    ]);
  });
});

describe('shareCardLayout', () => {
  const roster = [
    row({ id: 'a', power: 10 }),
    row({ id: 'b', power: 50 }),
    row({ id: 'c', power: 40 }),
    row({ id: 'd', power: 30 }),
    row({ id: 'e', power: 20 }),
  ];

  it('features the top three of the picked heroes and lists the rest strongest first', () => {
    const layout = shareCardLayout(roster, new Set(['a', 'c', 'd', 'e']));
    expect(ids(layout.featured)).toEqual(['c', 'd', 'e']);
    expect(ids(layout.rest)).toEqual(['a']);
    expect(layout.totals.totalPower).toBe(100);
  });

  it('leaves a hero that was not picked off the card entirely', () => {
    const layout = shareCardLayout(roster, new Set(['a', 'b']));
    expect(ids(layout.picked)).toEqual(['b', 'a']);
    expect(layout.totals.heroCount).toBe(2);
  });

  it('draws nothing when nobody is picked', () => {
    const layout = shareCardLayout(roster, new Set());
    expect(layout.featured).toEqual([]);
    expect(layout.rest).toEqual([]);
    expect(layout.totals).toEqual({ heroCount: 0, totalPower: 0, tierCounts: [] });
  });
});

describe('sharePicksFor', () => {
  const roster = [
    row({ id: 'in', battleAllowed: true }),
    row({ id: 'never-asked' }),
    row({ id: 'benched', battleAllowed: false }),
  ];

  it('picks the squad by default — every hero the account lets into battle', () => {
    expect([...sharePicksFor(roster, 'squad')].sort()).toEqual(['in', 'never-asked']);
  });

  it('picks everyone, or nobody', () => {
    expect(sharePicksFor(roster, 'everyone').size).toBe(3);
    expect(sharePicksFor(roster, 'none').size).toBe(0);
  });
});

describe('togglePick', () => {
  it('adds and removes one hero, and hands back the same set when nothing changes', () => {
    const start = new Set(['a']);
    expect([...togglePick(start, 'b', true)].sort()).toEqual(['a', 'b']);
    expect([...togglePick(start, 'a', false)]).toEqual([]);
    expect(togglePick(start, 'a', true)).toBe(start);
  });
});

describe('the card phase', () => {
  it('rounds and pulls a phase into the run the tables know', () => {
    expect(clampSharePhase(51.4, 310)).toBe(51);
    expect(clampSharePhase(0, 310)).toBe(1);
    expect(clampSharePhase(900, 310)).toBe(310);
  });

  it('refuses something that is not a phase', () => {
    expect(clampSharePhase(Number.NaN, 310)).toBeNull();
  });

  it('opens on the account phase, or on phase 1 when the account carried none', () => {
    expect(initialSharePhase(137, 310)).toBe(137);
    expect(initialSharePhase(null, 310)).toBe(1);
    expect(initialSharePhase(999, 310)).toBe(310);
  });
});

describe('defaultShareCardSettings', () => {
  it('opens on the squad, the account phase, gear and auras shown, the account number hidden', () => {
    const settings = defaultShareCardSettings(
      [row({ id: 'in' }), row({ id: 'out', battleAllowed: false })],
      137,
      310,
    );
    expect([...settings.picked]).toEqual(['in']);
    expect(settings).toMatchObject({
      phase: 137,
      showGear: true,
      showAuras: true,
      showAccountNumber: false,
    });
  });
});

describe('the hero picker filter', () => {
  const roster = [
    row({ id: 'ada', name: 'Ada', rarity: 'Mítico' }),
    row({ id: 'adao', name: 'Adão', rarity: 'Épico' }),
    row({ id: 'bo', name: 'Bo', rarity: 'Épico' }),
    row({ id: 'cy', name: 'Cy', rarity: 'Comum' }),
  ];

  it('shows everyone with no filter', () => {
    expect(ids(filterSharePickerRows(roster, EMPTY_SHARE_PICKER_FILTER))).toEqual(['ada', 'adao', 'bo', 'cy']);
  });

  it('matches a name part, ignoring case and accents', () => {
    expect(ids(filterSharePickerRows(roster, { text: ' ADA', rarities: [] }))).toEqual(['ada', 'adao']);
    expect(ids(filterSharePickerRows(roster, { text: 'adã', rarities: [] }))).toEqual(['ada', 'adao']);
  });

  it('keeps the rarities chosen, and combines them with the name', () => {
    const epic = toggleSharePickerRarity(EMPTY_SHARE_PICKER_FILTER, sharePickerRarities([roster[1] as RosterHeroRow])[0] ?? -1);
    expect(ids(filterSharePickerRows(roster, epic))).toEqual(['adao', 'bo']);
    expect(ids(filterSharePickerRows(roster, { ...epic, text: 'ad' }))).toEqual(['adao']);
  });

  it('turns a rarity chip off again', () => {
    const on = toggleSharePickerRarity(EMPTY_SHARE_PICKER_FILTER, 3);
    expect(toggleSharePickerRarity(on, 3).rarities).toEqual([]);
  });

  it('offers a chip for each rarity the roster holds, commonest first', () => {
    const offered = sharePickerRarities(roster);
    expect(offered).toEqual([...offered].sort((a, b) => a - b));
    expect(offered).toHaveLength(3);
  });
});

describe('shareDpsText', () => {
  it('prints a whole compact figure, or a dash for a hero with none worked out', () => {
    expect(shareDpsText(5298.4, 'en')).toBe('5.3k');
    expect(shareDpsText(950.6, 'en')).toBe('951');
    expect(shareDpsText(undefined, 'en')).toBe('—');
  });
});

describe('shareStars', () => {
  it('splits a hero stars into the lit and the unlit of three', () => {
    expect(shareStars(2)).toEqual({ filled: 2, empty: 1 });
    expect(shareStars(7)).toEqual({ filled: 3, empty: 0 });
  });

  it('draws nothing for a hero with no stars, not three unlit ones', () => {
    expect(shareStars(0)).toEqual({ filled: 0, empty: 0 });
  });
});
