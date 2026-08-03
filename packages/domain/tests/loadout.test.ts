import { describe, expect, it } from 'vitest';
import {
  emptyLoadout,
  type EquippedItem,
  type Loadout,
  type SheetStats,
} from '@/shared/domain/gear';
import { gearedAfterLoadoutChange, loadoutsEqual, patchSlot } from '@/shared/domain/loadout';

function item(defId: string, rarityIdx: number, level: number, upgrade: number): EquippedItem {
  return { defId, rarityIdx, level, upgrade };
}

/** Brenna-style loadout from the clay-gloves screenshot (matches in-game sheet). */
function clayGlovesLoadout(): Loadout {
  return {
    ...emptyLoadout(),
    arma: item('crimson_arma', 1, 50, 10),
    elmo: item('clay_elmo', 2, 40, 10),
    anel: item('clay_anel', 2, 40, 10),
    amuleto: item('sandstorm_amuleto', 2, 30, 10),
    peito: item('earth_peito', 2, 30, 10),
    calca: item('desert_calca', 3, 40, 11),
    luva: item('clay_luva', 2, 40, 10),
    bota: item('clay_bota', 2, 40, 10),
  };
}

const clayGeared = (): SheetStats => ({
  attack: 1934.6,
  energy: 879.1,
  speed: 52.6,
  critChance: 11.8,
  critDmg: 63.7,
  penetration: 74.7,
  cdr: 2.8,
  luck: 0,
});

describe('gearedAfterLoadoutChange', () => {
  it('is identity when the loadout did not change', () => {
    const loadout = clayGlovesLoadout();
    const geared = clayGeared();
    expect(gearedAfterLoadoutChange(geared, loadout, loadout)).toEqual(geared);
  });

  it('updates geared sheet when swapping clay → desert gloves (matches in-game)', () => {
    const from = clayGlovesLoadout();
    const to = patchSlot(from, 'luva', { defId: 'desert_luva' });
    expect(loadoutsEqual(from, to)).toBe(false);
    expect(to.luva?.defId).toBe('desert_luva');

    // Ponta de Diamante 10 — same sheetOther the planner passes into applyGear.
    // This screenshot predates the W3 (AD-BSP-18) 10->20 catalog rebalance, so it was
    // captured under the historical 2%/level rate (rank 10 -> +20 raw), not the current
    // 1%/level rate abilityMods() now produces. The historical rate is used explicitly here
    // rather than derived from the live catalog, so this test keeps proving
    // gearedAfterLoadoutChange against the real in-game numbers it was written against.
    const other = {
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 20,
      cdr: 0,
    };

    const projected = gearedAfterLoadoutChange(clayGeared(), from, to, other);

    // In-game geared stats with desert gloves (same level/rarity/upgrade).
    expect(projected.attack).toBeCloseTo(1934.6, 1);
    expect(projected.energy).toBeCloseTo(879.1, 1);
    expect(projected.speed).toBeCloseTo(53, 1);
    expect(projected.critChance).toBeCloseTo(11.8, 1);
    expect(projected.critDmg).toBeCloseTo(63.7, 1);
    expect(projected.penetration).toBeCloseTo(70.4, 1);
    expect(projected.cdr).toBeCloseTo(2.8, 1);
  });
});
