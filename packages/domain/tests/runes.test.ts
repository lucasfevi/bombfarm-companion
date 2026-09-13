/**
 * The rune model on its own terms (`runes.ts`): how the wire field is read, how a rune enters a
 * composed sheet, and that taking it back off before the point inversion recovers the same
 * points it was composed from. The live-capture proof — six real runed heroes landing exactly on
 * budget — is `runes-live-read.test.ts`; this file is the constructed half, and it holds on a
 * hero built by hand so it survives the corpus changing under it.
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { emptyLoadout, emptySheetOther } from '@bombfarm/domain/gear';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { WIKI_RUNES } from '@bombfarm/domain/phase-wiki';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import {
  applyRuneMultipliers,
  hasRuneOnSheet,
  readHeroRunes,
  RUNE_AXES,
  RUNE_AXIS_SHEET_KEY,
  runeSheetMultipliers,
  runesOf,
  stripRuneMultipliers,
  type HeroRune,
} from '@bombfarm/domain/runes';
import { peelSheetStages } from '@bombfarm/domain/sheet-stages';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const BIRTH = { attack: 180, energy: 200, speed: 60, critChance: 8, critDmg: 60, penetration: 6, cdr: 5, luck: 10 };
const TREE: TreeSheetTotals = { danoStatic: 2.5, energyPct: 80, speedPct: 20, critChancePct: 25, critDmgPct: 68, luckFlatPct: 10 };
const PTS = { attack: 40, energy: 30, speed: 10, critChance: 5, critDmg: 8, penetration: 0, cdr: 4, luck: 0 };
const LEVEL = 97;
const STARS = 2;

function rune(axis: HeroRune['axis'], p = 0.05, s = 80_000, r = 0): Record<string, unknown> {
  return { e: axis, p, s, r };
}

function compose(runes: readonly HeroRune[], pts = PTS) {
  return composeSheetFromBirth({
    birth: BIRTH,
    level: LEVEL,
    stars: STARS,
    sheetOther: emptySheetOther(),
    loadout: emptyLoadout(),
    pts,
    tree: TREE,
    runes,
  });
}

describe('readHeroRunes — the wire field, normalised at the boundary', () => {
  it('null, absent and non-list values are an empty list', () => {
    expect(readHeroRunes(null)).toEqual([]);
    expect(readHeroRunes(undefined)).toEqual([]);
    expect(readHeroRunes({ e: 'attack', p: 0.05, s: 1, r: 0 })).toEqual([]);
    expect(readHeroRunes('attack')).toEqual([]);
  });

  it('reads the live shape: `e` axis, `p` fraction → percent, `s` seconds, `r` rarity', () => {
    expect(readHeroRunes([rune('attack'), { e: 'gold', p: 0.09, s: 151765, r: 1 }])).toEqual([
      { axis: 'attack', strengthPct: 5, playSecondsLeft: 80_000, rarity: 0 },
      { axis: 'gold', strengthPct: 9, playSecondsLeft: 151765, rarity: 1 },
    ]);
  });

  it('drops a malformed entry on its own and keeps the rest', () => {
    const runes = readHeroRunes([
      rune('speed'),
      { e: 'dodge', p: 0.05, s: 1, r: 0 },
      { e: 'attack', p: 0, s: 1, r: 0 },
      { e: 'attack', p: -0.05, s: 1, r: 0 },
      { e: 'attack', p: '0.05', s: 1, r: 0 },
      { e: 'attack', p: 0.05, s: Number.NaN, r: 0 },
      'attack',
      null,
      { e: 'cdr', p: 0.13, s: -5, r: 'x' },
    ]);
    expect(runes).toEqual([
      { axis: 'speed', strengthPct: 5, playSecondsLeft: 80_000, rarity: 0 },
      { axis: 'cdr', strengthPct: 13, playSecondsLeft: 0, rarity: 0 },
    ]);
  });

  it('runesOf reads an absent list as empty', () => {
    expect(runesOf({})).toEqual([]);
    expect(runesOf({ runes: null })).toEqual([]);
  });
});

describe('the wiki bundle carries the rune block', () => {
  it('names the eight axes the wire uses, in order', () => {
    expect(WIKI_RUNES.axes).toEqual([...RUNE_AXES]);
  });

  it('strength by rarity, duration and caps are the published values', () => {
    expect(WIKI_RUNES.strengthByRarity).toEqual([0.05, 0.09, 0.13, 0.17, 0.21, 0.25]);
    expect(WIKI_RUNES.durationPlaySecs).toBe(86_400);
    expect(WIKI_RUNES.capPlaySecs).toBe(3 * 86_400);
    expect(WIKI_RUNES.capRunes).toBe(3);
    expect(WIKI_RUNES.marketMinRarity).toBe(2);
  });

  it('the two axes the wiki gives no stat index are the two the model keeps off the sheet', () => {
    const offSheet = WIKI_RUNES.axes.filter((axis) => WIKI_RUNES.statIndexByAxis[axis] === undefined);
    expect(offSheet).toEqual(['xp', 'gold']);
    expect(RUNE_AXES.filter((axis) => RUNE_AXIS_SHEET_KEY[axis] === null)).toEqual(['xp', 'gold']);
  });
});

describe('runeSheetMultipliers', () => {
  it('is 1 on every key with no runes', () => {
    const mult = runeSheetMultipliers([]);
    for (const key of SHEET_KEYS) expect(mult[key]).toBe(1);
  });

  it('a rarity-0 attack rune is ×1.05 on attack and nothing else', () => {
    const mult = runeSheetMultipliers(readHeroRunes([rune('attack')]));
    expect(mult.attack).toBeCloseTo(1.05, 12);
    for (const key of SHEET_KEYS) if (key !== 'attack') expect(mult[key]).toBe(1);
  });

  it('xp and gold runes touch no sheet key', () => {
    const mult = runeSheetMultipliers(readHeroRunes([rune('xp'), rune('gold')]));
    for (const key of SHEET_KEYS) expect(mult[key]).toBe(1);
    expect(hasRuneOnSheet(readHeroRunes([rune('xp'), rune('gold')]))).toBe(false);
    expect(hasRuneOnSheet(readHeroRunes([rune('gold'), rune('cdr')]))).toBe(true);
  });
});

describe('a rune on the composed sheet', () => {
  it('multiplies the final attack by 1.05 and leaves every other key untouched', () => {
    const bare = compose([]);
    const runed = compose(readHeroRunes([rune('attack')]));
    expect(runed.attack).toBeCloseTo(bare.attack * 1.05, 9);
    for (const key of SHEET_KEYS) if (key !== 'attack') expect(runed[key]).toBe(bare[key]);
  });

  it('crit damage: the rune multiplies the pre-tree excess and the tree adds on top', () => {
    const bare = compose([]);
    const runed = compose(readHeroRunes([rune('critdmg')]));
    expect(runed.critDmg).toBeCloseTo((bare.critDmg - TREE.critDmgPct) * 1.05 + TREE.critDmgPct, 9);
    expect(runed.critDmg).not.toBeCloseTo(bare.critDmg * 1.05, 3);
  });

  it('an empty list composes exactly the sheet composed with no list at all', () => {
    const withoutField = composeSheetFromBirth({
      birth: BIRTH,
      level: LEVEL,
      stars: STARS,
      sheetOther: emptySheetOther(),
      loadout: emptyLoadout(),
      pts: PTS,
      tree: TREE,
    });
    expect(compose([])).toEqual(withoutField);
  });

  it('strip is the exact inverse of apply', () => {
    const mult = runeSheetMultipliers(readHeroRunes(RUNE_AXES.map((axis) => rune(axis, 0.13))));
    const sheet = compose([]);
    const back = stripRuneMultipliers(applyRuneMultipliers(sheet, TREE, mult), TREE, mult);
    for (const key of SHEET_KEYS) expect(back[key]).toBeCloseTo(sheet[key], 9);
  });

  it('the stages table gains a rune Δ that closes the telescoping sum', () => {
    const runes = readHeroRunes([rune('attack'), rune('critdmg'), rune('speed')]);
    const total = compose(runes);
    const stages = peelSheetStages({
      birth: BIRTH,
      level: LEVEL,
      stars: STARS,
      sheetOther: emptySheetOther(),
      loadout: emptyLoadout(),
      pts: PTS,
      tree: TREE,
      runes,
    });
    for (const key of SHEET_KEYS) {
      const row = stages[key];
      const sum =
        row.birth +
        row.deltaLevel +
        row.deltaStars +
        row.deltaAbility +
        row.deltaGear +
        row.deltaPoints +
        row.deltaTree +
        row.deltaRune;
      expect(sum, key).toBeCloseTo(total[key], 9);
      expect(row.total, key).toBeCloseTo(total[key], 9);
    }
    expect(stages.attack.deltaRune).toBeGreaterThan(0);
    expect(stages.energy.deltaRune).toBe(0);
  });
});

describe('spent-point recovery on a runed sheet', () => {
  const runes = readHeroRunes([rune('attack'), rune('energy'), rune('speed'), rune('crit'), rune('critdmg'), rune('cdr')]);

  function infer(sheet: ReturnType<typeof compose>, withRunes: readonly HeroRune[]) {
    return inferSpentPoints({
      birth: BIRTH,
      level: LEVEL,
      stars: STARS,
      sheetOther: emptySheetOther(),
      loadout: emptyLoadout(),
      tree: TREE,
      sheet,
      statPointsAvailable: 0,
      runes: withRunes,
    });
  }

  it('lands exactly on the points the sheet was composed from, with no issue', () => {
    const { pts, issues } = infer(compose(runes), runes);
    expect(issues).toEqual([]);
    expect(pts).toEqual(PTS);
  });

  it('charges the rune to points when the rune is not handed over — the failure this exists to prevent', () => {
    const { pts, issues } = infer(compose(runes), []);
    expect(issues.some((issue) => issue.kind === 'budgetMismatch')).toBe(true);
    expect(SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0)).toBeGreaterThan(LEVEL);
  });
});

describe('the importer', () => {
  function payloadWith(runas: unknown) {
    const base = loadFixtureJson('save-20260831-13heroes-soulbound.json');
    const heroes = (base.heroes as Record<string, unknown>[]).map((hero, index) =>
      index === 0 ? { ...hero, runas } : hero,
    );
    return { ...base, heroes };
  }

  it('a hero with `runas: null` is byte-identical to one without the key, plus an empty list', () => {
    const withNull = parseAccountPayload(payloadWith(null) as never, []).candidates[0];
    const withoutKey = parseAccountPayload(loadFixtureJson('save-20260831-13heroes-soulbound.json') as never, [])
      .candidates[0];
    expect(withNull.record.runes).toEqual([]);
    expect(withoutKey.record.runes).toEqual([]);
    expect(withNull).toEqual(withoutKey);
    expect(JSON.stringify(withNull)).toBe(JSON.stringify(withoutKey));
  });

  it('carries the parsed runes on the record and folds them into the zero-points sheet', () => {
    const bare = parseAccountPayload(payloadWith(null) as never, []).candidates[0];
    const runed = parseAccountPayload(payloadWith([rune('attack')]) as never, []).candidates[0];
    expect(runed.record.runes).toEqual([{ axis: 'attack', strengthPct: 5, playSecondsLeft: 80_000, rarity: 0 }]);
    expect(runed.record.gearedOverride.attack).toBeCloseTo(bare.record.gearedOverride.attack * 1.05, 9);
    expect(runed.record.gearedOverride.energy).toBe(bare.record.gearedOverride.energy);
  });
});
