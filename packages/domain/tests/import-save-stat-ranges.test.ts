/**
 * The window each birth value was rolled inside: read per hero, per statistic, and forgiving
 * everywhere. Expected values here are hand-converted literals, never a round trip through the
 * converter under test.
 */
import { describe, expect, it } from 'vitest';
import { parseAccountPayload, parseSaveFile } from '@bombfarm/domain/import-save';
import { readStatRanges } from '@bombfarm/domain/save-units';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { AccountPayload } from '@bombfarm/contracts';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

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

const RANGES = {
  dmg: { min: 65, max: 110 },
  energia: { min: 120, max: 160 },
  speed: { min: 47, max: 51.5 },
  penetration: { min: 0.5, max: 2.5 },
  crit_chance: { min: 0.03, max: 0.09 },
  cooldown_reduction: { min: 0.005, max: 0.03 },
  crit_dmg: { min: 1.45, max: 1.7 },
  luck: { min: 0.01, max: 0.07 },
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

const rangesOf = (hero: Record<string, unknown>) => importedRecords([hero])[0]?.statRanges;

/**
 * Endpoint-wise so the percent conversions can be written as the round numbers a reader can
 * check by hand — `(1.45 − 1) × 100` lands on 44.99999999999999 in binary floating point, and a
 * literal repeating that residue proves nothing about the arithmetic.
 */
function expectBand(band: { min: number; max: number } | undefined, min: number, max: number) {
  expect(band?.min).toBeCloseTo(min, 10);
  expect(band?.max).toBeCloseTo(max, 10);
}

describe('reading a hero’s roll bounds off the payload', () => {
  it('converts every statistic into planner units', () => {
    const ranges = rangesOf({ stat_ranges: RANGES });

    expect(Object.keys(ranges ?? {}).sort()).toEqual([
      'attack',
      'cdr',
      'critChance',
      'critDmg',
      'energy',
      'luck',
      'penetration',
      'speed',
    ]);
    expectBand(ranges?.attack, 65, 110);
    expectBand(ranges?.energy, 120, 160);
    expectBand(ranges?.speed, 47, 51.5);
    expectBand(ranges?.penetration, 0.5, 2.5);
    expectBand(ranges?.critChance, 3, 9);
    expectBand(ranges?.cdr, 0.5, 3);
    expectBand(ranges?.critDmg, 45, 70);
    expectBand(ranges?.luck, 1, 7);
  });

  it('leaves the field absent when the hero carries no bounds at all', () => {
    expect(rangesOf({})).toBeUndefined();
  });

  it('leaves the field absent when the block is not an object', () => {
    expect(rangesOf({ stat_ranges: 'wide' })).toBeUndefined();
    expect(rangesOf({ stat_ranges: null })).toBeUndefined();
    expect(rangesOf({ stat_ranges: [] })).toBeUndefined();
  });

  it('drops one unreadable statistic and keeps the rest', () => {
    const { crit_dmg: _dropped, ...withoutCritDmg } = RANGES;
    const ranges = rangesOf({ stat_ranges: withoutCritDmg });

    expect(ranges?.critDmg).toBeUndefined();
    expectBand(ranges?.attack, 65, 110);
  });

  it('never invents a zero band for a statistic the payload omitted', () => {
    const { crit_dmg: _dropped, ...withoutCritDmg } = RANGES;

    expect(rangesOf({ stat_ranges: withoutCritDmg })).not.toHaveProperty('critDmg');
  });

  it('drops a statistic missing an endpoint, or carrying a non-numeric one', () => {
    const ranges = rangesOf({
      stat_ranges: {
        ...RANGES,
        dmg: { min: 65 },
        energia: { max: 160 },
        speed: { min: '47', max: 51.5 },
        luck: { min: 0.01, max: Number.NaN },
      },
    });

    expect(ranges?.attack).toBeUndefined();
    expect(ranges?.energy).toBeUndefined();
    expect(ranges?.speed).toBeUndefined();
    expect(ranges?.luck).toBeUndefined();
    expectBand(ranges?.critChance, 3, 9);
  });

  it('drops an inverted band rather than silently swapping its ends', () => {
    const ranges = rangesOf({ stat_ranges: { ...RANGES, dmg: { min: 110, max: 65 } } });

    expect(ranges?.attack).toBeUndefined();
    expectBand(ranges?.energy, 120, 160);
  });

  it('drops a zero-width band', () => {
    const ranges = rangesOf({ stat_ranges: { ...RANGES, dmg: { min: 65, max: 65 } } });

    expect(ranges?.attack).toBeUndefined();
    expectBand(ranges?.energy, 120, 160);
  });

  it('ignores a key it does not recognise', () => {
    const ranges = rangesOf({ stat_ranges: { ...RANGES, sorte_extra: { min: 1, max: 2 } } });

    expect(ranges).not.toHaveProperty('sorte_extra');
    expectBand(ranges?.attack, 65, 110);
  });

  it('answers nothing when every statistic is unreadable', () => {
    expect(readStatRanges({ dmg: { min: 110, max: 65 }, luck: 'unknown' })).toBeUndefined();
  });
});

describe('bounds are enrichment, so their absence rejects nothing', () => {
  it('imports a hero that has a birth roll and no bounds', () => {
    const result = parseSaveFile(saveWithHeroes([{}]), []);

    expect(result.rejected).toBeNull();
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.record.birth).toBeDefined();
    expect(result.candidates[0]?.record.statRanges).toBeUndefined();
  });

  it('imports a save where one hero carries bounds and another does not', () => {
    const result = parseSaveFile(saveWithHeroes([{ stat_ranges: RANGES }, {}]), []);

    expect(result.rejected).toBeNull();
    expect(result.candidates.map((candidate) => candidate.record.statRanges !== undefined)).toEqual([
      true,
      false,
    ]);
  });
});

describe('both import entry points carry the bounds', () => {
  it('the live account read agrees with the saved export, statistic for statistic', () => {
    const payload = saveWithHeroes([{ stat_ranges: RANGES }]) as unknown as AccountPayload;
    const viaPayload = parseAccountPayload(payload, []).candidates[0]?.record.statRanges;

    expect(viaPayload).toEqual(rangesOf({ stat_ranges: RANGES }));
    expectBand(viaPayload?.critChance, 3, 9);
  });
});

describe('re-importing the same payload stores the same bounds', () => {
  it('gives the second pass over an already-imported hero the same value as the first', () => {
    const save = saveWithHeroes([{ stat_ranges: RANGES }]);
    const first = parseSaveFile(save, []).candidates[0]?.record;
    if (!first) throw new Error('expected the first pass to yield a candidate');

    const stored: HeroRecord = { ...first, id: 'existing-1', updatedAt: 0 };
    const second = parseSaveFile(save, [stored]).candidates[0];

    expect(second?.matchedExistingId).toBe('existing-1');
    expect(second?.record.statRanges).toEqual(first.statRanges);
    expect(second?.record.statRanges).toBeDefined();
  });
});

describe('a real capture', () => {
  it('carries Jon’s published bounds through the importer in planner units', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const jon = parseSaveFile(raw, []).candidates.find((candidate) => candidate.name === 'Jon');

    expectBand(jon?.record.statRanges?.attack, 65, 110);
    expectBand(jon?.record.statRanges?.critChance, 3, 9);
    expectBand(jon?.record.statRanges?.critDmg, 45, 70);
  });
});
