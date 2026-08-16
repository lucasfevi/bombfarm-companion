import { describe, expect, it } from 'vitest';
import {
  SHEET_DISPLAY_KEYS,
  SHEET_KEYS,
  SHEET_PANEL_KEYS,
  ZERO_PTS,
  ZERO_PTS_TEMPLATE,
  type SheetKey,
} from '@bombfarm/domain/planner-constants';
import {
  applyGear,
  applyPoints,
  defaultNaked,
  emptyLoadout,
  emptySheet,
  emptySheetOther,
  reverseGear,
  reverseSheet,
  starsMult,
  sumGearBonuses,
  type Loadout,
  type SheetStats,
} from '@bombfarm/domain/gear';
import { BASE_ROLLS, POINT_GAIN, STAT_LABELS, rankNextPoint, type Context, type HeroSheet } from '@bombfarm/domain/model';

// Wave 6 (DEC-12, BSPW6-AC-24) rewrites this block's W2 AC-02 assertion: SHEET_DISPLAY_KEYS
// (7, combat/mismatch) no longer stands alone — SHEET_PANEL_KEYS (8, display surfaces) now
// exists beside it (DEC-06), and Luck displays via the latter, not the former.
describe('SHEET_PANEL_KEYS / SHEET_DISPLAY_KEYS — the 8/7 split (BSPW2-AC-02, BSPW6-AC-24)', () => {
  it('SHEET_PANEL_KEYS has all 8 keys in in-game display order (luck after speed)', () => {
    expect(SHEET_PANEL_KEYS).toEqual([
      'attack',
      'energy',
      'speed',
      'luck',
      'critChance',
      'critDmg',
      'penetration',
      'cdr',
    ]);
    expect(SHEET_PANEL_KEYS).toHaveLength(8);
    expect(new Set(SHEET_PANEL_KEYS)).toEqual(new Set(SHEET_KEYS));
  });

  it('SHEET_DISPLAY_KEYS equals SHEET_KEYS with luck removed, in the same relative order', () => {
    expect(SHEET_DISPLAY_KEYS).toEqual(
      (SHEET_KEYS as readonly string[]).filter((key) => key !== 'luck'),
    );
    expect(SHEET_DISPLAY_KEYS).toHaveLength(7);
  });

  it('SHEET_KEYS and SHEET_PANEL_KEYS include luck; SHEET_DISPLAY_KEYS does not', () => {
    expect((SHEET_KEYS as readonly string[]).includes('luck')).toBe(true);
    expect((SHEET_PANEL_KEYS as readonly string[]).includes('luck')).toBe(true);
    expect((SHEET_DISPLAY_KEYS as readonly string[]).includes('luck')).toBe(false);
  });
});

describe('the sheet model carries eight stats, luck last (BSPW2-AC-01)', () => {
  it('SHEET_KEYS is the eight-key model list', () => {
    expect(SHEET_KEYS).toEqual([
      'attack',
      'energy',
      'speed',
      'critChance',
      'critDmg',
      'penetration',
      'cdr',
      'luck',
    ]);
  });

  it('emptySheet() / ZERO_PTS() / ZERO_PTS_TEMPLATE carry the same eight keys, in the same order', () => {
    expect(Object.keys(emptySheet())).toEqual([...SHEET_KEYS]);
    expect(Object.keys(ZERO_PTS())).toEqual([...SHEET_KEYS]);
    expect(Object.keys(ZERO_PTS_TEMPLATE)).toEqual([...SHEET_KEYS]);
  });
});

const naked = (): SheetStats => ({
  attack: 200,
  energy: 300,
  speed: 50,
  critChance: 10,
  critDmg: 70,
  penetration: 5,
  cdr: 5,
  luck: 20,
});

function loadoutWithSorte(): Loadout {
  const loadout = emptyLoadout();
  // The 2026-08-16 redistribution gave every slot a fixed roll priority, and `arma` no longer
  // rolls sorte at any rarity (dmg > crit > penetracao > cooldown > velocidade > energia).
  // `amuleto` leads with sorte, so rarityIdx 0 (statCount 1) is enough to carry it — a stronger
  // subject than the old one, which needed Incomum to reach its second roll.
  loadout.amuleto = { defId: 'forest_amuleto', rarityIdx: 0, level: 10, upgrade: 0 };
  return loadout;
}

describe('GearBonuses.luckPct is consumed, not duplicated or ignored (BSPW2-AC-03)', () => {
  it('applyGear multiplies naked.luck by (1 + gear luckPct) and differs from naked.luck', () => {
    const n0 = naked();
    const loadout = loadoutWithSorte();
    const bonuses = sumGearBonuses(loadout);
    expect(bonuses.luckPct).toBeGreaterThan(0);
    const geared = applyGear(n0, loadout);
    expect(geared.luck).toBeCloseTo(n0.luck * (1 + bonuses.luckPct), 10);
    expect(geared.luck).not.toBeCloseTo(n0.luck, 6);
  });

  it('applyGear leaves luck bit-identical when no gear rolls sorte', () => {
    const n0 = naked();
    const geared = applyGear(n0, emptyLoadout());
    expect(geared.luck).toBe(n0.luck);
  });
});

describe('reverseGear / reverseSheet invert luck exactly (BSPW2-AC-04)', () => {
  it('reverseGear recovers naked.luck from applyGear output', () => {
    const n0 = naked();
    const loadout = loadoutWithSorte();
    const geared = applyGear(n0, loadout);
    const recovered = reverseGear(geared, loadout);
    expect(Math.abs(recovered.luck - n0.luck)).toBeLessThan(1e-12);
  });

  it('reverseSheet recovers naked.luck from applyPoints output (with gear + points + stars)', () => {
    const n0 = naked();
    const loadout = loadoutWithSorte();
    const pts = { ...ZERO_PTS(), luck: 5, attack: 2 };
    const other = emptySheetOther();
    const level = 30;
    const stars = 2;
    const sheet = applyPoints(n0, loadout, pts, other, level, stars);
    const recovered = reverseSheet(sheet, loadout, pts, other, level, stars);
    expect(Math.abs(recovered.luck - n0.luck)).toBeLessThan(1e-12);
  });
});

describe('defaultNaked luck: star-scaled, level-independent (BSPW2-AC-05)', () => {
  it('equals BASE_ROLLS[rarity].luck × starsMult(stars) at ★0', () => {
    const result = defaultNaked('Raro', 0, undefined, 0);
    expect(result.luck).toBeCloseTo(BASE_ROLLS.Raro.luck * starsMult(0), 10);
  });

  it('is independent of level', () => {
    const lv0 = defaultNaked('Lendária', 0, undefined, 2);
    const lv90 = defaultNaked('Lendária', 90, undefined, 2);
    expect(lv90.luck).toBe(lv0.luck);
  });

  it('scales with stars like the other star-scaled stats', () => {
    const result = defaultNaked('Mítico', 50, undefined, 2);
    expect(result.luck).toBeCloseTo(BASE_ROLLS.Mítico.luck * starsMult(2), 10);
  });
});

describe('POINT_GAIN.luckPctOfBase (BSPW2-AC-07, BSP-46)', () => {
  it('equals 0.03', () => {
    expect(POINT_GAIN.luckPctOfBase).toBe(0.03);
  });
});

// MP5 F1 — RECORDED LOSS (AD-068 "deleted, not weakened"): the deleted
// `luck per-point value against Wave 0 fixtures` describe block (2 tests, Vera ★0 and
// Bellatrix ★1) compared two REAL observations of the SAME hero before/after spending exactly
// one Luck point (`vera-01` -> `vera-02`, `bellatrix-01` -> `bellatrix-02`). This is the
// point-delta before/after family design.md §10 / the spec's Assumptions table names as
// unreproducible: every post-wipe corpus hero has `stat_points_available: 0` (every point is
// already spent), so no zero-point "before" state exists to pair with a "+1 point" state.
// `point-roundtrip.test.ts` (T4, `AD-071`) is the replacement — a stronger, corpus-anchored
// claim that the forward per-point math reproduces the game's own observed sheet — but it
// cannot isolate a single point's marginal value the way this deleted pair could. See
// docs/fixture-corpus.md.

describe('applyPoints consumes POINT_GAIN.luckPctOfBase from the production path (BSPW2-AC-10)', () => {
  it('sheet luck increases by naked.luck × pts.luck × luckPctOfBase with other=0, gear=0', () => {
    const n0 = naked();
    const loadout = emptyLoadout();
    const pts = { ...ZERO_PTS(), luck: 3 };
    const sheet = applyPoints(n0, loadout, pts, emptySheetOther());
    const expected = (n0.luck * (1 + 0 + pts.luck * POINT_GAIN.luckPctOfBase)) / (1 + 0);
    expect(sheet.luck).toBeCloseTo(expected, 10);
  });
});

describe('luck never reaches DPS scoring (BSPW2-AC-11, BSPW2-AC-12, BSP-42, AD-BSP-20)', () => {
  it('STAT_LABELS has exactly seven keys and never contains luck', () => {
    expect(Object.keys(STAT_LABELS)).toHaveLength(7);
    expect(Object.keys(STAT_LABELS)).not.toContain('luck');
  });

  it('rankNextPoint returns exactly 7 ranked stats and excludes luck even with a hostile effectiveDeltas.luck', () => {
    const hero: HeroSheet = {
      rarity: 'Raro',
      attack: 100,
      energy: 100,
      speed: 50,
      critChance: 10,
      critDmg: 70,
      penetration: 5,
      cdr: 5,
      attackPerPoint: 10,
      energyPerPoint: 8,
    };
    const ctx: Context = {
      restSeconds: 600,
      mitigation: 0.1,
      blastRange: 1,
      cycleModel: 'serial',
      walkDelay: 0.15,
      drainMult: 1,
    };
    // A variable (not a fresh literal) of the wider Record<SheetKey, number> shape —
    // exactly how advisor-pipeline.ts passes equippedResult.effectiveDelta through,
    // which is why the type system alone does not keep luck out (ASM-10).
    const effectiveDeltas: Record<SheetKey, number> = {
      attack: 1,
      energy: 1,
      speed: 1,
      critChance: 1,
      critDmg: 1,
      penetration: 1,
      cdr: 1,
      luck: 9999,
    };
    const ranking = rankNextPoint(hero, ctx, { effectiveDeltas });
    expect(ranking).toHaveLength(7);
    expect(ranking.every((entry) => (entry.stat as string) !== 'luck')).toBe(true);
  });
});
