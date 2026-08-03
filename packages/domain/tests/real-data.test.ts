// Regression tests against real BombFarm save-file data: for each hero, the naked
// (unequipped, in-game) sheet and equipped items are real, observed values; the
// expected geared sheet is the real in-game value read from the same account.
// This validates the whole forward pipeline (catalog item scaling + forge/rarity
// multipliers + the shared-pool `applyGear` formula) against the actual game,
// not just internally-consistent round-trips.
//
// Note: these naked readings were taken without resetting stat points first, so
// Crit Damage in particular includes whatever points the player had already sunk
// into it (each point is +10% of base, uncapped) — it is not a "pure" naked value
// the way `defaultNaked()` computes it. That's fine here: items never touch Crit
// Damage (`applyGear` passes it through unchanged), so the round-trip is still a
// valid check regardless of what naked components fed into that specific number.
//
// Tolerances are loose (±0.5 abs or ±0.5% rel) because the naked inputs below are
// only known to the precision the game's UI displays (1 decimal / whole numbers).
import { describe, expect, it } from 'vitest';
import { applyGear, emptyLoadout, type EquippedItem, type Loadout, type SheetStats } from '@bombfarm/domain/gear';

function closeEnough(actual: number, expected: number) {
  const tol = Math.max(0.5, Math.abs(expected) * 0.005);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
}

function item(defId: string, rarityIdx: number, level: number, upgrade: number): EquippedItem {
  return { defId, rarityIdx, level, upgrade };
}

function loadoutOf(gear: {
  arma: EquippedItem;
  elmo: EquippedItem;
  peito: EquippedItem;
  calca: EquippedItem;
  bota: EquippedItem;
  luva: EquippedItem;
  anel: EquippedItem;
  amuleto: EquippedItem;
}): Loadout {
  return { ...emptyLoadout(), ...gear };
}

describe('real save-file heroes: naked + real gear -> real geared sheet', () => {
  it('Bram (Lendária L54, Olho 10) matches the real geared sheet', () => {
    const naked: SheetStats = {
      attack: 1077,
      energy: 958.9,
      speed: 54.5,
      critChance: 10.7,
      critDmg: 568.6,
      penetration: 4.2,
      cdr: 7.5,
      luck: 0,
    };
    const loadout = loadoutOf({
      arma: item('crimson_arma', 2, 50, 10),
      elmo: item('clay_elmo', 3, 40, 10),
      peito: item('autumn_peito', 2, 50, 10),
      calca: item('crimson_calca', 3, 50, 10),
      bota: item('autumn_bota', 3, 50, 10),
      luva: item('topaz_luva', 2, 40, 10),
      anel: item('crimson_anel', 2, 50, 10),
      amuleto: item('steel_amuleto', 2, 20, 11),
    });
    const other = { speed: 0, critChance: 0.15, critDmg: 0, penetration: 0, cdr: 0 }; // Olho Clínico 10
    const geared = applyGear(naked, loadout, other);
    const real: SheetStats = {
      attack: 2813.85298902889,
      energy: 1735.6461974717,
      speed: 55.9644119281198,
      critChance: 53.357434677588,
      critDmg: 568.649603632037,
      penetration: 43.2430175343221,
      cdr: 7.46057961071935,
      luck: 0,
    };
    for (const k of Object.keys(real) as (keyof SheetStats)[]) closeEnough(geared[k], real[k]);
  });

  it('Finn (Incomum L62, no sheet abilities) matches the real geared sheet', () => {
    const naked: SheetStats = {
      attack: 549.8,
      energy: 239.3,
      speed: 49.6,
      critChance: 11.1,
      critDmg: 673.5,
      penetration: 1.2,
      cdr: 3.1,
      luck: 0,
    };
    const loadout = loadoutOf({
      arma: item('crimson_arma', 1, 50, 10),
      elmo: item('autumn_elmo', 3, 50, 10),
      peito: item('autumn_peito', 2, 50, 10),
      calca: item('coal_calca', 3, 30, 10),
      bota: item('crimson_bota', 3, 50, 10),
      luva: item('crimson_luva', 3, 50, 11),
      anel: item('autumn_anel', 2, 50, 10),
      amuleto: item('autumn_amuleto', 2, 50, 10),
    });
    const geared = applyGear(naked, loadout);
    const real: SheetStats = {
      attack: 2441.82493951693,
      energy: 519.34801552514,
      speed: 50.4105687616877,
      critChance: 72.8550819504995,
      critDmg: 673.548340217765,
      penetration: 11.4293545303848,
      cdr: 10.8361190232358,
      luck: 0,
    };
    for (const k of Object.keys(real) as (keyof SheetStats)[]) closeEnough(geared[k], real[k]);
  });

  it('Dara (Raro L52, Olho 10) matches the real geared sheet', () => {
    const naked: SheetStats = {
      attack: 503,
      energy: 475.5,
      speed: 51.6,
      critChance: 9.3,
      critDmg: 636.3,
      penetration: 5,
      cdr: 3,
      luck: 0,
    };
    const loadout = loadoutOf({
      arma: item('jade_arma', 2, 50, 10),
      elmo: item('desert_elmo', 3, 40, 10),
      peito: item('autumn_peito', 2, 50, 10),
      calca: item('desert_calca', 2, 40, 10),
      bota: item('topaz_bota', 3, 40, 10),
      luva: item('desert_luva', 2, 40, 10),
      anel: item('clay_anel', 2, 40, 10),
      amuleto: item('gold_amuleto', 4, 20, 10),
    });
    const other = { speed: 0, critChance: 0.15, critDmg: 0, penetration: 0, cdr: 0 }; // Olho Clínico 10
    const geared = applyGear(naked, loadout, other);
    const real: SheetStats = {
      attack: 2087.01181007616,
      energy: 1588.14360045798,
      speed: 53.2719766242718,
      critChance: 28.4133003056346,
      critDmg: 636.328171034855,
      penetration: 8.55583475447325,
      cdr: 5.84141859482476,
      luck: 0,
    };
    for (const k of Object.keys(real) as (keyof SheetStats)[]) closeEnough(geared[k], real[k]);
  });
});
