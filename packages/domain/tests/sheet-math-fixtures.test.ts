/**
 * Sheet-math integration fixtures (Brenna + Dara Olho + Gale points).
 *
 * Ground truth = BombFarm save exports under `fixtures/sheet-math/`.
 * Tests run applyGear / applyPoints / projectGearedOntoLoadout at full save
 * precision (not the 1-decimal UI).
 *
 * Capture notes:
 * - brenna-01-baseline: Desert gloves, Ponta 10, points reset (from SaveFile).
 * - brenna-02-naked: all slots null; same abilities — true Base with Ponta.
 * - brenna-03-clay-luva: clay gloves swap (same lv/rarity/upgrade).
 * - brenna-04-ponta-0: abilities cleared; gear matches baseline.
 * - gale-01 / 02 / 03: Gale L55 Raro — points reset, +5 Attack, respec +5 Crit
 *   (post-2026-07-25 rebalance: +10 atk × levelPowerMult, +2% crit of base).
 * - Dara Olho: L54 Olho 10 from dara-05-olho-10.json (same account dump as
 *   Brenna naked); Olho 0 from dara-05-olho-0.json. Both still have 1 leftover
 *   stat point — assert Olho delta / forward with reverse-inferred naked.
 *
 * Known model notes:
 * - Dara Olho pair still has 1 leftover stat point on both captures.
 */
import { describe, expect, it } from 'vitest';
import {
  applyGear,
  applyPoints,
  projectGearedOntoLoadout,
  reverseGear,
  type SheetStats,
} from '@bombfarm/domain/gear';
import { attackPointGain } from '@bombfarm/domain/model';
import { starsMult } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { gearedAfterLoadoutChange } from '@bombfarm/domain/loadout';
import {
  expectSheetsClose,
  loadHero,
  SHEET_ABS_TOL,
} from './helpers/sheet-math-fixtures';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';

const BRENNA = 'Brenna';
const GALE = 'Gale';
const GALE_LEVEL = 55;
const DARA = 'Dara';
const DARA_LEVEL = 54;

describe('sheet-math fixtures: Brenna', () => {
  const naked = loadHero('brenna-02-naked.json', BRENNA);
  const baseline = loadHero('brenna-01-baseline.json', BRENNA);
  const clay = loadHero('brenna-03-clay-luva.json', BRENNA);
  const ponta0 = loadHero('brenna-04-ponta-0.json', BRENNA);

  // These captures predate the W3 (AD-BSP-18) 10->20 catalog rebalance — the raw fixture
  // JSON itself still reads ability "max": 10 for ponta_diamante. The shared fixture helper
  // derives sheetOther from the LIVE (current, post-rebalance) catalog via abilityMods(),
  // which is correct for post-rebalance fixtures (bellatrix-02-pts-each-1.json) but wrong
  // here: these real in-game observations were captured under the historical 2%/level rate
  // (ponta_diamante @ rank 10 -> +20 raw), not the current 1%/level rate. Overriding with the
  // historical rate keeps these tests proving what they always proved — that applyGear /
  // reverseGear / projectGearedOntoLoadout reconstruct a real observed save sheet — without
  // asserting a number the live catalog no longer produces (AD-BSP-18 confirms ponta_diamante
  // 2 -> 1.0 as one of only two "confirmed twice" halving cases).
  const HISTORICAL_PONTA_10 = { ...naked.sheetOther, penetration: 20 };

  it('naked fixture has empty loadout and Ponta 10 sheetOther (historical 2%/level rate)', () => {
    expect(Object.values(naked.loadout).every((s) => s == null)).toBe(true);
    expect(naked.abilities.ponta_diamante).toBe(10);
    expect(HISTORICAL_PONTA_10.penetration).toBe(20);
    expect(naked.statPointsAvailable).toBe(50);
  });

  it('naked Base matches applyGear(naked, empty) identity', () => {
    const got = applyGear(naked.sheet, naked.loadout, HISTORICAL_PONTA_10);
    expectSheetsClose(got, naked.sheet);
  });

  it('baseline Desert loadout: applyGear(naked, gear, Ponta10) matches save', () => {
    expect(baseline.loadout.luva?.defId).toBe('desert_luva');
    expect(baseline.abilities.ponta_diamante).toBe(10);
    const got = applyGear(naked.sheet, baseline.loadout, HISTORICAL_PONTA_10);
    // Full-precision match — including Crit — when naked comes from the save.
    expectSheetsClose(got, baseline.sheet);
  });

  it('clay gloves: applyGear(naked, clayLoadout) matches save', () => {
    expect(clay.loadout.luva?.defId).toBe('clay_luva');
    const got = applyGear(naked.sheet, clay.loadout, HISTORICAL_PONTA_10);
    expectSheetsClose(got, clay.sheet);
  });

  it('clay ↔ desert: projectGearedOntoLoadout matches the other save sheet', () => {
    const toClay = projectGearedOntoLoadout(
      baseline.sheet,
      baseline.loadout,
      clay.loadout,
      HISTORICAL_PONTA_10,
    );
    expectSheetsClose(toClay, clay.sheet);

    const toDesert = projectGearedOntoLoadout(
      clay.sheet,
      clay.loadout,
      baseline.loadout,
      HISTORICAL_PONTA_10,
    );
    expectSheetsClose(toDesert, baseline.sheet);

    const viaHelper = gearedAfterLoadoutChange(
      baseline.sheet,
      baseline.loadout,
      clay.loadout,
      HISTORICAL_PONTA_10,
    );
    expectSheetsClose(viaHelper, clay.sheet);
  });

  it('ponta-0: applyGear with sheetOther.penetration=0 matches save pen drop', () => {
    expect(ponta0.abilities.ponta_diamante).toBeUndefined();
    expect(ponta0.sheetOther.penetration).toBe(0);
    // Naked without Ponta: reverse the ponta-0 geared sheet (same gear, no other).
    const nakedNoPonta = reverseGear(ponta0.sheet, ponta0.loadout, ponta0.sheetOther);
    const got = applyGear(nakedNoPonta, ponta0.loadout, ponta0.sheetOther);
    expectSheetsClose(got, ponta0.sheet);
    // Pen must be far below Ponta-10 baseline.
    expect(ponta0.sheet.penetration).toBeLessThan(baseline.sheet.penetration - 50);
  });
});

describe('sheet-math fixtures: Gale L55 (post-rebalance points)', () => {
  const reset = loadHero('gale-01-points-reset.json', GALE, GALE_LEVEL);
  const ptsAttack5 = loadHero('gale-02-pts-attack-5.json', GALE, GALE_LEVEL);
  const ptsCrit5 = loadHero('gale-03-pts-crit-5.json', GALE, GALE_LEVEL);

  it('points-reset: full gear loadout, 55 unspent stat points, 1★', () => {
    expect(reset.statPointsAvailable).toBe(55);
    expect(reset.stars).toBe(1);
    expect(Object.values(reset.loadout).filter(Boolean).length).toBe(8);
    expect(reset.abilities.bateria_extra).toBe(10);
    expect(reset.sheetOther.penetration).toBe(0);
    expect(reset.sheetOther.critChance).toBe(0);
  });

  it('pts-attack-5: applyPoints matches save after +5 Attack', () => {
    expect(ptsAttack5.statPointsAvailable).toBe(50);
    const delta = ptsAttack5.sheet.attack - reset.sheet.attack;
    expect(delta).toBeCloseTo(5 * attackPointGain(GALE_LEVEL) * starsMult(reset.stars), 6);

    const naked = reverseGear(reset.sheet, reset.loadout, reset.sheetOther);
    const pts = ZERO_PTS();
    pts.attack = 5;
    const got = applyPoints(naked, reset.loadout, pts, reset.sheetOther, GALE_LEVEL, reset.stars);
    expectSheetsClose(got, ptsAttack5.sheet);
  });

  it('pts-crit-5: applyPoints matches save after respec +5 Crit', () => {
    expect(ptsCrit5.statPointsAvailable).toBe(50);
    expect(ptsCrit5.sheet.attack).toBeCloseTo(reset.sheet.attack, 6);

    const naked = reverseGear(reset.sheet, reset.loadout, reset.sheetOther);
    const pts = ZERO_PTS();
    pts.critChance = 5;
    const got = applyPoints(naked, reset.loadout, pts, reset.sheetOther, GALE_LEVEL, reset.stars);
    expectSheetsClose(got, ptsCrit5.sheet);
  });
});

describe('sheet-math fixtures: Dara Olho', () => {
  const olho10 = loadHero('dara-05-olho-10.json', DARA, DARA_LEVEL);
  const olho0 = loadHero('dara-05-olho-0.json', DARA, DARA_LEVEL);

  // Same pre-rebalance situation as Brenna's ponta_diamante above: this real capture predates
  // the W3 catalog migration and was taken under the historical olho_clinico rate (1.5%/level
  // -> +15% at rank 10), not the current 0.75%/level rate the live catalog now correctly
  // produces (AD-BSP-18's other "confirmed twice" halving case). Override with the historical
  // rate so this test keeps proving pipeline correctness against the real observed sheet.
  const HISTORICAL_OLHO_10 = { ...olho10.sheetOther, critChance: 0.15 };

  it('olho-10 fixture has Olho 10; olho-0 has no sheet Olho', () => {
    expect(olho10.abilities.olho_clinico).toBe(10);
    expect(HISTORICAL_OLHO_10.critChance).toBeCloseTo(0.15, 10);
    expect(olho0.abilities.olho_clinico).toBeUndefined();
    expect(olho0.sheetOther.critChance).toBe(0);
    // Leftover point on both captures — do not assume fully reset points.
    expect(olho10.statPointsAvailable).toBe(1);
    expect(olho0.statPointsAvailable).toBe(1);
  });

  it('olho-10 → olho-0: reversing gear keeps implied naked consistent with sheetOther', () => {
    // Same gear on both files; only sheet abilities (Olho) change.
    const naked10 = reverseGear(olho10.sheet, olho10.loadout, HISTORICAL_OLHO_10);
    const naked0 = reverseGear(olho0.sheet, olho0.loadout, olho0.sheetOther);

    // Attack/energy/speed/pen/cdr should match across Olho toggle (Olho is crit-only).
    for (const k of ['attack', 'energy', 'speed', 'penetration', 'cdr', 'critDmg'] as const) {
      expect(Math.abs(naked10[k] - naked0[k]), k).toBeLessThanOrEqual(SHEET_ABS_TOL[k]);
    }
    // Naked crit drops when Olho is removed: naked = base × (1 + olho).
    expect(naked10.critChance / naked0.critChance).toBeCloseTo(1.15, 6);

    const forward10 = applyGear(naked10, olho10.loadout, HISTORICAL_OLHO_10);
    const forward0 = applyGear(naked0, olho0.loadout, olho0.sheetOther);
    expectSheetsClose(forward10, olho10.sheet);
    expectSheetsClose(forward0, olho0.sheet);
  });

  it('olho delta on geared crit matches shared-pool rescale', () => {
    // geared = naked × (1+o+gear)/(1+o); naked10 = naked0 × 1.15 with o=0.15 vs 0.
    const naked0 = reverseGear(olho0.sheet, olho0.loadout, olho0.sheetOther);
    const naked10: SheetStats = {
      ...naked0,
      critChance: naked0.critChance * 1.15,
    };
    const projected = applyGear(naked10, olho10.loadout, HISTORICAL_OLHO_10);
    expect(projected.critChance).toBeCloseTo(olho10.sheet.critChance, 6);
  });
});

describe('sheet-math fixtures: tolerance smoke', () => {
  it('SHEET_KEYS stay in sync with expectSheetsClose defaults', () => {
    for (const k of SHEET_KEYS) {
      expect(SHEET_ABS_TOL[k]).toBeTypeOf('number');
    }
  });
});
