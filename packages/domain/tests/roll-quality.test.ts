import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SheetStats } from '@bombfarm/domain/gear';
import { SHEET_KEYS, ZERO_PTS_TEMPLATE, type SheetKey } from '@bombfarm/domain/planner-constants';
import { rollQualityFor, statRollsFor } from '@bombfarm/domain/roll-quality';
import { birthFromSave, readStatRanges } from '@bombfarm/domain/save-units';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { isJson, listFiles } from './helpers/list-files';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, 'fixtures');

function heroWith(fields: Partial<HeroRecord>): HeroRecord {
  return {
    id: 'hero-1',
    name: 'Hero',
    updatedAt: 0,
    rarity: 'Comum',
    level: 1,
    stars: 0,
    naked: { ...ZERO_PTS_TEMPLATE } as SheetStats,
    loadout: {},
    altLoadout: null,
    gearedOverride: { ...ZERO_PTS_TEMPLATE } as SheetStats,
    abilities: {},
    pts: { ...ZERO_PTS_TEMPLATE },
    ...fields,
  };
}

function birthWith(values: Partial<Record<SheetKey, number>>): SheetStats {
  return { ...ZERO_PTS_TEMPLATE, ...values } as SheetStats;
}

type MutableStatRanges = { -readonly [K in SheetKey]?: { min: number; max: number } };

type SaveHero = {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly rank?: unknown;
  readonly birth_stats?: Record<string, unknown>;
  readonly stat_ranges?: unknown;
};

function recordFromSaveHero(hero: SaveHero): HeroRecord {
  return heroWith({
    id: String(hero.id),
    name: String(hero.name),
    rank: typeof hero.rank === 'string' ? hero.rank : undefined,
    birth: birthFromSave(hero.birth_stats ?? {}),
    statRanges: readStatRanges(hero.stat_ranges),
  });
}

type CorpusEntry = { readonly file: string; readonly hero: SaveHero };

function loadCorpus(): CorpusEntry[] {
  const entries: CorpusEntry[] = [];
  for (const file of listFiles(FIXTURES_DIR, isJson)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const heroes = (parsed as { heroes?: unknown })?.heroes;
    if (!Array.isArray(heroes)) continue;
    for (const hero of heroes as SaveHero[]) {
      if (hero?.birth_stats && hero?.stat_ranges) entries.push({ file, hero });
    }
  }
  return entries;
}

const CORPUS = loadCorpus();

/** Save key → planner key, mirroring the importer's own projection. */
const SAVE_KEY_BY_SHEET_KEY: Record<SheetKey, string> = {
  attack: 'dmg',
  energy: 'energia',
  speed: 'speed',
  critChance: 'crit_chance',
  critDmg: 'crit_dmg',
  penetration: 'penetration',
  cdr: 'cooldown_reduction',
  luck: 'luck',
};

describe('rollQualityFor: the worked example', () => {
  const payload = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'api', 'assembled-payload-after.json'), 'utf8'),
  ) as { heroes: SaveHero[] };
  const nyx = payload.heroes.find((h) => String(h.id) === '555');

  it('the fixture still carries the hero this example is written against', () => {
    expect(nyx, 'hero id 555 in api/assembled-payload-after.json').toBeDefined();
    expect(nyx?.name).toBe('Nyx');
  });

  const report = rollQualityFor(recordFromSaveHero(nyx as SaveHero));

  const EXPECTED: Record<SheetKey, number> = {
    attack: 20.395336195060263,
    energy: 77.21944331581994,
    speed: 66.87303137610662,
    penetration: 46.92891294276276,
    critChance: 89.92153560075947,
    cdr: 38.08989115898587,
    critDmg: 46.087916962676715,
    luck: 86.18447633482728,
  };

  for (const key of SHEET_KEYS) {
    it(`places ${key} at its published position inside the band`, () => {
      expect(report?.perStat[key].percentile).toBeCloseTo(EXPECTED[key], 10);
      expect(report?.perStat[key].outOfBand).toBeUndefined();
      expect(report?.perStat[key].unavailableReason).toBeUndefined();
    });
  }

  it('averages the eight positions unweighted', () => {
    expect(report?.mean).toBeCloseTo(58.96256798587487, 10);
    expect(report?.contributingStats).toBe(8);
  });
});

describe('percentiles do not depend on the unit system', () => {
  it('the corpus walk finds hero entries carrying both a roll and its bounds', () => {
    expect(CORPUS.length).toBeGreaterThan(100);
  });

  it('a percentile from the save-unit values equals the one from the stored planner-unit values', () => {
    let maxDelta = 0;
    let worst = '';
    let compared = 0;
    for (const { file, hero } of CORPUS) {
      const rolls = statRollsFor(recordFromSaveHero(hero));
      const rawBands = hero.stat_ranges as Record<string, { min?: unknown; max?: unknown }>;
      const rawRoll = hero.birth_stats as Record<string, unknown>;
      for (const key of SHEET_KEYS) {
        const band = rawBands[SAVE_KEY_BY_SHEET_KEY[key]];
        const value = rawRoll[SAVE_KEY_BY_SHEET_KEY[key]];
        if (typeof band?.min !== 'number' || typeof band?.max !== 'number') continue;
        if (!(band.max > band.min) || typeof value !== 'number') continue;
        const inSaveUnits = ((value - band.min) / (band.max - band.min)) * 100;
        const inPlannerUnits = rolls[key].percentile;
        expect(inPlannerUnits, `${file} ${key}`).toBeDefined();
        const delta = Math.abs(inSaveUnits - (inPlannerUnits as number));
        compared += 1;
        if (delta > maxDelta) {
          maxDelta = delta;
          worst = `${file} ${key}`;
        }
      }
    }
    expect(compared).toBeGreaterThan(800);
    expect(maxDelta, `worst disagreement at ${worst}`).toBeLessThan(1e-12);
  });
});

describe('rollQualityFor: statistics that cannot be placed', () => {
  it('a zero-width band yields no percentile and is not a percentile of zero', () => {
    const report = rollQualityFor(
      heroWith({
        birth: birthWith({ attack: 50, energy: 120 }),
        statRanges: { attack: { min: 50, max: 50 }, energy: { min: 100, max: 200 } },
      }),
    );
    expect(report?.perStat.attack.percentile).toBeUndefined();
    expect(report?.perStat.attack.unavailableReason).toBe('zeroWidthBand');
    expect(report?.perStat.attack.band).toEqual({ min: 50, max: 50 });
    expect(report?.contributingStats).toBe(1);
    expect(report?.mean).toBeCloseTo(20, 10);
  });

  it('an inverted band is no usable band, not a negative percentile', () => {
    const report = rollQualityFor(
      heroWith({
        birth: birthWith({ attack: 50, energy: 120 }),
        statRanges: { attack: { min: 90, max: 10 }, energy: { min: 100, max: 200 } },
      }),
    );
    expect(report?.perStat.attack.percentile).toBeUndefined();
    expect(report?.perStat.attack.unavailableReason).toBe('noBand');
    expect(report?.perStat.attack.band).toBeUndefined();
    expect(report?.contributingStats).toBe(1);
  });

  it('a statistic missing from the bounds leaves the other seven computing', () => {
    const bands: MutableStatRanges = {};
    const birth: Partial<Record<SheetKey, number>> = {};
    for (const key of SHEET_KEYS) {
      birth[key] = 25;
      if (key !== 'luck') bands[key] = { min: 0, max: 100 };
    }
    const report = rollQualityFor(heroWith({ birth: birthWith(birth), statRanges: bands }));
    expect(report?.perStat.luck.percentile).toBeUndefined();
    expect(report?.perStat.luck.unavailableReason).toBe('noBand');
    expect(report?.perStat.luck.value).toBe(25);
    expect(report?.contributingStats).toBe(7);
    expect(report?.mean).toBeCloseTo(25, 10);
  });

  it('no bounds at all reports unavailable rather than a fabricated number', () => {
    expect(rollQualityFor(heroWith({ birth: birthWith({ attack: 50 }) }))).toBeUndefined();
    const rolls = statRollsFor(heroWith({ birth: birthWith({ attack: 50 }) }));
    for (const key of SHEET_KEYS) expect(rolls[key].unavailableReason).toBe('noBand');
  });

  it('no birth roll reports unavailable on every statistic', () => {
    const hero = heroWith({
      statRanges: { attack: { min: 0, max: 100 }, luck: { min: 0, max: 10 } },
    });
    expect(rollQualityFor(hero)).toBeUndefined();
    const rolls = statRollsFor(hero);
    for (const key of SHEET_KEYS) {
      expect(rolls[key].unavailableReason).toBe('noBirthRoll');
      expect(rolls[key].value).toBeUndefined();
    }
  });
});

describe('rollQualityFor: a roll outside its own band', () => {
  it('clamps a roll below the band to zero and flags it', () => {
    const report = rollQualityFor(
      heroWith({
        birth: birthWith({ attack: 5, energy: 150 }),
        statRanges: { attack: { min: 40, max: 70 }, energy: { min: 100, max: 200 } },
      }),
    );
    expect(report?.perStat.attack.percentile).toBe(0);
    expect(report?.perStat.attack.outOfBand).toBe(true);
    expect(report?.mean).toBeCloseTo(25, 10);
  });

  it('clamps a roll above the band to one hundred and flags it', () => {
    const report = rollQualityFor(
      heroWith({
        birth: birthWith({ attack: 500, energy: 150 }),
        statRanges: { attack: { min: 40, max: 70 }, energy: { min: 100, max: 200 } },
      }),
    );
    expect(report?.perStat.attack.percentile).toBe(100);
    expect(report?.perStat.attack.outOfBand).toBe(true);
    expect(report?.mean).toBeCloseTo(75, 10);
  });

  it('a roll exactly on either edge is inside its band', () => {
    const report = rollQualityFor(
      heroWith({
        birth: birthWith({ attack: 40, energy: 200 }),
        statRanges: { attack: { min: 40, max: 70 }, energy: { min: 100, max: 200 } },
      }),
    );
    expect(report?.perStat.attack.percentile).toBe(0);
    expect(report?.perStat.attack.outOfBand).toBeUndefined();
    expect(report?.perStat.energy.percentile).toBe(100);
    expect(report?.perStat.energy.outOfBand).toBeUndefined();
  });
});

describe('the mean is unweighted over the statistics that contributed', () => {
  it('excludes an unplaceable statistic instead of scoring it zero', () => {
    const withGap = rollQualityFor(
      heroWith({
        birth: birthWith({ attack: 90, energy: 150, speed: 50 }),
        statRanges: {
          attack: { min: 0, max: 100 },
          energy: { min: 100, max: 200 },
          speed: { min: 50, max: 50 },
        },
      }),
    );
    expect(withGap?.contributingStats).toBe(2);
    expect(withGap?.mean).toBeCloseTo(70, 10);

    const scoringTheGapAsZero = (90 + 50 + 0) / 3;
    expect(withGap?.mean).not.toBeCloseTo(scoringTheGapAsZero, 6);
  });

  it('counts exactly the statistics that produced a percentile', () => {
    const bands: MutableStatRanges = {};
    const birth: Partial<Record<SheetKey, number>> = {};
    for (const key of SHEET_KEYS) birth[key] = 10;
    for (const key of ['attack', 'energy', 'speed'] as const) bands[key] = { min: 0, max: 100 };
    const report = rollQualityFor(heroWith({ birth: birthWith(birth), statRanges: bands }));
    expect(report?.contributingStats).toBe(3);
    const placed = SHEET_KEYS.filter((key) => report?.perStat[key].percentile !== undefined);
    expect(placed).toEqual(['attack', 'energy', 'speed']);
  });
});
