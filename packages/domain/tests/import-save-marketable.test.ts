import { describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { RARITIES } from '@bombfarm/domain/planner-constants';

const BIRTH = {
  dmg: 100,
  energia: 150,
  speed: 45,
  crit_chance: 0.05,
  crit_dmg: 1.5,
  penetration: 0.5,
  cooldown_reduction: 0.01,
  luck: 0.02,
};

function saveWithHeroes(heroes: Record<string, unknown>[]) {
  return {
    export_version: 1,
    generated_at: '2026-08-25T00:00:00Z',
    heroes: heroes.map((overrides, index) => ({
      id: `900${index}`,
      name: `Subject ${index}`,
      level: 5,
      rarity: 1,
      stars: 0,
      battle_allowed: true,
      abilities: [],
      stat_points_available: 0,
      birth_stats: BIRTH,
      stats: BIRTH,
      ...overrides,
    })),
    items: [],
    skills: { refunds: {}, totals: { vagas_campo: 0, bag_tabs_bonus: 0 }, levels: {} },
    casa: { active_casa: 1, cycle_secs: 1000, levels: [1, 0, 0, 0, 0], slots: 1 },
  };
}

const importedRecords = (heroes: Record<string, unknown>[]) =>
  parseSaveFile(saveWithHeroes(heroes), []).candidates.map((candidate) => candidate.record);

describe('the importer carries the game’s "may be sold" flag', () => {
  it('keeps a sellable hero, a bound one and a hero the save said nothing about apart', () => {
    const [sellable, bound, unstated] = importedRecords([
      { marketable: true },
      { marketable: false },
      {},
    ]);

    expect(sellable?.marketable).toBe(true);
    expect(bound?.marketable).toBe(false);
    expect(unstated?.marketable).toBeUndefined();
  });

  it('never turns a non-boolean into an answer, so a garbled flag reads as unasked', () => {
    const [fromString, fromNull, fromNumber] = importedRecords([
      { marketable: 'true' },
      { marketable: null },
      { marketable: 0 },
    ]);

    expect(fromString?.marketable).toBeUndefined();
    expect(fromNull?.marketable).toBeUndefined();
    expect(fromNumber?.marketable).toBeUndefined();
  });

  it('reads the flag off the hero it belongs to, not off the first one in the file', () => {
    const records = importedRecords([{ marketable: false }, { marketable: true }]);

    expect(records.map((record) => record.marketable)).toEqual([false, true]);
  });
});

describe('the rarity a hero imports with', () => {
  it('is the save index read against the planner rarity order, so a price key can use either', () => {
    const records = importedRecords(RARITIES.map((_, index) => ({ rarity: index })));

    expect(records.map((record) => record.rarity)).toEqual(RARITIES);
  });
});
