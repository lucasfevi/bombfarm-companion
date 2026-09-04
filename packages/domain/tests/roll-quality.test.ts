import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SheetStats } from '@bombfarm/domain/gear';
import { SHEET_KEYS, ZERO_PTS_TEMPLATE, type SheetKey } from '@bombfarm/domain/planner-constants';
import {
  LETTER_BANDS,
  compareRollQuality,
  distanceToNextLetter,
  isNearBoundary,
  letterForRollQuality,
  rollQualityFor,
  statRollsFor,
  type LetterEvidence,
} from '@bombfarm/domain/roll-quality';
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

const NYX = (
  JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'api', 'assembled-payload-after.json'), 'utf8'),
  ) as { heroes: SaveHero[] }
).heroes.find((h) => String(h.id) === '555') as SaveHero;

describe('rollQualityFor: the worked example', () => {
  it('the fixture still carries the hero this example is written against', () => {
    expect(NYX, 'hero id 555 in api/assembled-payload-after.json').toBeDefined();
    expect(NYX.name).toBe('Nyx');
  });

  const report = rollQualityFor(recordFromSaveHero(NYX));

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

function heroScoring(mean: number, rank?: string): HeroRecord {
  return heroWith({
    rank,
    birth: birthWith({ attack: mean }),
    statRanges: { attack: { min: 0, max: 100 } },
  });
}

/** One entry per distinct hero, keyed on the birth-roll signature the letter table is derived on. */
function distinctCorpusHeroes(): { readonly hero: SaveHero; readonly mean: number }[] {
  const bySignature = new Map<string, { hero: SaveHero; mean: number }>();
  for (const { hero } of CORPUS) {
    const report = rollQualityFor(recordFromSaveHero(hero));
    if (report === undefined) continue;
    const signature = SHEET_KEYS.map(
      (key) => (hero.birth_stats as Record<string, unknown>)[SAVE_KEY_BY_SHEET_KEY[key]],
    ).join('|');
    if (!bySignature.has(signature)) bySignature.set(signature, { hero, mean: report.mean });
  }
  return [...bySignature.values()];
}

const DISTINCT = distinctCorpusHeroes();

describe('LETTER_BANDS still describes the corpus it was derived from', () => {
  it('the corpus still holds the 65 distinct heroes the table was read off', () => {
    expect(DISTINCT.length).toBe(65);
  });

  for (const evidence of LETTER_BANDS.evidence) {
    it(`${evidence.letter}: the recorded hero count and observed extremes match the corpus`, () => {
      const means = DISTINCT.filter((entry) => entry.hero.rank === evidence.letter).map((e) => e.mean);
      expect(means.length).toBe(evidence.heroes);
      expect(Math.min(...means)).toBeCloseTo(evidence.observedMin, 4);
      expect(Math.max(...means)).toBeCloseTo(evidence.observedMax, 4);
    });
  }

  it('orders the letters with no inversions: no hero outscores one of a higher letter', () => {
    const inversions: string[] = [];
    for (const a of DISTINCT) {
      for (const b of DISTINCT) {
        const rankA = LETTER_BANDS.letters.indexOf(String(a.hero.rank));
        const rankB = LETTER_BANDS.letters.indexOf(String(b.hero.rank));
        if (rankA < rankB && a.mean >= b.mean) {
          inversions.push(`${a.hero.rank} ${a.mean} >= ${b.hero.rank} ${b.mean}`);
        }
      }
    }
    expect(inversions).toEqual([]);
  });

  it('every boundary interval is empty: no observed hero falls inside one', () => {
    const inside = DISTINCT.filter((entry) => isNearBoundary(entry.mean)).map(
      (entry) => `${entry.hero.rank} ${entry.mean}`,
    );
    expect(inside).toEqual([]);
  });

  it('places every corpus hero on the letter the game itself stored', () => {
    const wrong = DISTINCT.filter((entry) => letterForRollQuality(entry.mean) !== entry.hero.rank).map(
      (entry) => `${entry.hero.rank} ${entry.mean}`,
    );
    expect(wrong).toEqual([]);
  });

  it('reports no disagreement and no unknown letter anywhere in the corpus', () => {
    for (const { hero } of CORPUS) {
      const report = rollQualityFor(recordFromSaveHero(hero));
      expect(report?.disagrees, String(hero.name)).toBe(false);
      expect(report?.unknownLetter, String(hero.name)).toBe(false);
    }
  });
});

describe('letterForRollQuality', () => {
  it('places the worked-example hero on the letter its record already carries', () => {
    const report = rollQualityFor(recordFromSaveHero(NYX));
    expect(report?.storedLetter).toBe('A');
    expect(report?.computedLetter).toBe('A');
    expect(report?.disagrees).toBe(false);
    expect(report?.nearBoundary).toBe(false);
    expect(report?.unknownLetter).toBe(false);
  });

  it('is open-ended at both ends — the observed extremes are not limits', () => {
    expect(letterForRollQuality(0)).toBe('E');
    expect(letterForRollQuality(LETTER_BANDS.evidence[0].observedMin - 10)).toBe('E');
    expect(letterForRollQuality(100)).toBe('S');
    expect(letterForRollQuality(LETTER_BANDS.evidence[5].observedMax + 10)).toBe('S');
  });

  for (const boundary of LETTER_BANDS.boundaries) {
    const pair = `${boundary.below}/${boundary.above}`;

    it(`${pair}: a mean inside the interval is near an edge, not a disagreement`, () => {
      const mean = (boundary.min + boundary.max) / 2;
      for (const stored of [boundary.below, boundary.above]) {
        const report = rollQualityFor(heroScoring(mean, stored));
        expect(report?.nearBoundary, stored).toBe(true);
        expect(report?.disagrees, stored).toBe(false);
        expect(report?.storedLetter, stored).toBe(stored);
      }
    });

    it(`${pair}: the interval sits between the two letters' observed extremes`, () => {
      const below = LETTER_BANDS.evidence.find((e) => e.letter === boundary.below) as LetterEvidence;
      const above = LETTER_BANDS.evidence.find((e) => e.letter === boundary.above) as LetterEvidence;
      expect(boundary.min).toBeGreaterThanOrEqual(below.observedMax);
      expect(boundary.max).toBeLessThanOrEqual(above.observedMin);
      expect(boundary.min).toBeLessThan(boundary.max);
    });
  }
});

describe('a disagreement is reported, never resolved', () => {
  const maximalBands: MutableStatRanges = {};
  const maximalBirth: Partial<Record<SheetKey, number>> = {};
  for (const key of SHEET_KEYS) {
    maximalBands[key] = { min: 0, max: 100 };
    maximalBirth[key] = 100;
  }
  const report = rollQualityFor(
    heroWith({ rank: 'E', birth: birthWith(maximalBirth), statRanges: maximalBands }),
  );

  it('a hero rolling the top of every band while stored as the lowest grade disagrees', () => {
    expect(report?.mean).toBe(100);
    expect(report?.computedLetter).toBe('S');
    expect(report?.disagrees).toBe(true);
  });

  it('returns the stored letter unchanged even so', () => {
    expect(report?.storedLetter).toBe('E');
  });

  it('one letter apart is never a disagreement, however far from the boundary', () => {
    const middleOfB = (LETTER_BANDS.evidence[3].observedMin + LETTER_BANDS.evidence[3].observedMax) / 2;
    const oneOff = rollQualityFor(heroScoring(middleOfB, 'A'));
    expect(oneOff?.computedLetter).toBe('B');
    expect(oneOff?.nearBoundary).toBe(false);
    expect(oneOff?.disagrees).toBe(false);
  });
});

describe('a stored letter this table does not know', () => {
  it('reports unknownLetter and never a disagreement', () => {
    const report = rollQualityFor(heroScoring(100, 'F'));
    expect(report?.unknownLetter).toBe(true);
    expect(report?.disagrees).toBe(false);
    expect(report?.storedLetter).toBe('F');
    expect(report?.computedLetter).toBe('S');
  });

  it('treats an absent stored letter the same way', () => {
    const report = rollQualityFor(heroScoring(100));
    expect(report?.unknownLetter).toBe(true);
    expect(report?.disagrees).toBe(false);
    expect(report?.storedLetter).toBeUndefined();
  });
});

describe('distance to the next letter is a range, not a number', () => {
  it('measures to both edges of the boundary interval', () => {
    const boundary = LETTER_BANDS.boundaries[2];
    const distance = distanceToNextLetter(50);
    expect(distance?.letter).toBe('B');
    expect(distance?.min).toBeCloseTo(boundary.min - 50, 10);
    expect(distance?.max).toBeCloseTo(boundary.max - 50, 10);
    expect(distance?.min).toBeLessThan(distance?.max as number);
  });

  it('is carried on the report, and absent on the top band, which has no next letter', () => {
    expect(rollQualityFor(heroScoring(50))?.toNextLetter?.letter).toBe('B');
    expect(rollQualityFor(heroScoring(90))?.toNextLetter).toBeUndefined();
  });
});

describe('compareRollQuality', () => {
  it('orders best roll first and unavailable last', () => {
    const rows = [{ id: 'c' }, { id: 'a', rollQuality: 40 }, { id: 'b', rollQuality: 80 }];
    expect([...rows].sort(compareRollQuality).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('breaks ties on hero id, so the same set orders the same way from any starting order', () => {
    const tied = [
      { id: 'delta', rollQuality: 60 },
      { id: 'alpha', rollQuality: 60 },
      { id: 'charlie', rollQuality: 60 },
    ];
    const forwards = [...tied].sort(compareRollQuality).map((r) => r.id);
    const backwards = [...tied].reverse().sort(compareRollQuality).map((r) => r.id);
    expect(forwards).toEqual(['alpha', 'charlie', 'delta']);
    expect(backwards).toEqual(forwards);
  });

  it('orders two heroes with no roll quality at all by id rather than arbitrarily', () => {
    const rows = [{ id: 'z' }, { id: 'y' }];
    expect([...rows].sort(compareRollQuality).map((r) => r.id)).toEqual(['y', 'z']);
    expect([...rows].reverse().sort(compareRollQuality).map((r) => r.id)).toEqual(['y', 'z']);
  });
});
