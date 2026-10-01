import { describe, expect, it } from 'vitest';
import {
  composeSheetFromBirth,
  nakedFromBirth,
  type BirthStats,
  type TreeSheetTotals,
} from '@bombfarm/domain/birth-sheet';
import { emptySheetOther, sumGearBonuses } from '@bombfarm/domain/gear';
import { rescaleNakedCdr } from '@bombfarm/domain/gear/naked-rescale';
import type { Loadout } from '@bombfarm/domain/gear/types';
import { ABILITIES, abilityMods, isSheetAbility, STAT_CAPS } from '@bombfarm/domain/model';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { gameSheetView } from '@bombfarm/domain/sheet-view';

const BIRTH: BirthStats = {
  attack: 304.7,
  energy: 276.3,
  speed: 53.6,
  penetration: 5.5,
  critChance: 7.4,
  cdr: 2.9,
  critDmg: 86.7,
  luck: 11,
};

const GEARED: Loadout = {
  arma: { defId: 'ash_arma', rarityIdx: 1, level: 80, upgrade: 14 },
  elmo: { defId: 'wooden_elmo', rarityIdx: 1, level: 110, upgrade: 13 },
  anel: { defId: 'autumn_anel', rarityIdx: 3, level: 50, upgrade: 13 },
  amuleto: { defId: 'autumn_amuleto', rarityIdx: 3, level: 50, upgrade: 13 },
  peito: { defId: 'autumn_peito', rarityIdx: 3, level: 50, upgrade: 13 },
  calca: { defId: 'glacier_calca', rarityIdx: 2, level: 60, upgrade: 13 },
  luva: { defId: 'wooden_luva', rarityIdx: 0, level: 110, upgrade: 13 },
  bota: { defId: 'forest_bota', rarityIdx: 1, level: 100, upgrade: 13 },
};

const NO_TREE: TreeSheetTotals = { danoStatic: 1, energyPct: 0, speedPct: 0, critChancePct: 0, critDmgPct: 0, luckFlatPct: 0 };

const LEVEL = 60;

function sheetOtherAt(rank: number) {
  return { ...emptySheetOther(), cdr: abilityMods({ pavio_curto: rank }).sheetCdrFlat };
}

function composeAt(rank: number, loadout: Loadout, pts = ZERO_PTS(), birth: BirthStats = BIRTH) {
  return composeSheetFromBirth({
    birth,
    level: LEVEL,
    stars: 0,
    sheetOther: sheetOtherAt(rank),
    loadout,
    pts,
    tree: NO_TREE,
  });
}

describe('Short Fuse adds flat cooldown reduction to the carrier sheet', () => {
  it('is a sheet ability, not a combat one', () => {
    expect(isSheetAbility(ABILITIES.find((ability) => ability.id === 'pavio_curto')!)).toBe(true);
  });

  it('adds exactly half a point per level', () => {
    expect(abilityMods({ pavio_curto: 0 }).sheetCdrFlat).toBe(0);
    expect(abilityMods({ pavio_curto: 1 }).sheetCdrFlat).toBe(0.5);
    expect(abilityMods({ pavio_curto: 20 }).sheetCdrFlat).toBe(10);
  });

  it('moves a bare hero by 0.5 points per level', () => {
    const empty: Loadout = {};
    const base = composeAt(0, empty).cdr;
    for (const rank of [1, 7, 20]) {
      expect(composeAt(rank, empty).cdr - base).toBeCloseTo(rank * 0.5, 12);
    }
  });

  it('adds 10 points at rank 20 to a hero whose gear and spent points already carry cooldown reduction', () => {
    expect(sumGearBonuses(GEARED).cdrPct).toBeGreaterThan(0.2);
    const pts = { ...ZERO_PTS(), cdr: 5 };
    const without = composeAt(0, GEARED, pts).cdr;
    const withFuse = composeAt(20, GEARED, pts).cdr;
    expect(withFuse - without).toBeCloseTo(10, 12);
  });

  it('is capped at the cooldown-reduction ceiling on the displayed sheet', () => {
    const uncapped = composeAt(20, GEARED, ZERO_PTS(), { ...BIRTH, cdr: 75 });
    expect(uncapped.cdr).toBeGreaterThan(STAT_CAPS.cdr);
    expect(gameSheetView(uncapped).cdr).toBe(STAT_CAPS.cdr);
  });

  it('swaps its addend on the naked sheet without touching the hero roll', () => {
    const naked = nakedFromBirth(BIRTH, LEVEL, 0, sheetOtherAt(4));
    const next = rescaleNakedCdr(naked, 2, 5);
    expect(next.cdr - naked.cdr).toBeCloseTo(3, 12);
    expect(next.attack).toBe(naked.attack);
  });
});

describe('importing a Short Fuse carrier', () => {
  function inferFor(rank: number, spentCdr: number) {
    const sheetOther = sheetOtherAt(rank);
    const pts = { ...ZERO_PTS(), cdr: spentCdr };
    const sheet = composeAt(rank, GEARED, pts);
    return inferSpentPoints({
      birth: BIRTH,
      level: LEVEL,
      stars: 0,
      sheetOther,
      loadout: GEARED,
      tree: NO_TREE,
      sheet,
      statPointsAvailable: LEVEL - spentCdr,
    });
  }

  it('infers zero spent cooldown points when the exported value includes the addend', () => {
    const inferred = inferFor(20, 0);
    expect(inferred.pts.cdr).toBe(0);
    expect(inferred.issues).toEqual([]);
  });

  it('still recovers the points the player really spent', () => {
    const inferred = inferFor(20, 7);
    expect(inferred.pts.cdr).toBe(7);
    expect(inferred.issues).toEqual([]);
  });
});
