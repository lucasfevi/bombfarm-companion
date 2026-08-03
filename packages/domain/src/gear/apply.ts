import { attackPointGain, POINT_GAIN } from '../model';
import { emptySheetOther, starsMult, sumGearBonuses } from './catalog';
import type { Loadout, PointAlloc, SheetOtherPct, SheetStats } from './types';

/**
 * Shared bonus pool: sheet = base × (1 + other + gear [+ points]).
 * Unequipped naked = base × (1 + other), so
 *   geared = naked × (1 + other + gear) / (1 + other)
 * (Compounding naked × (1+gear) only matches when other = 0.)
 * Confirmed 2026-07-20: Olho 10 → naked 10.7%; Olho 0 → 9.3%; Anel +47.5% → 15.1% / 13.7%.
 */
function sharedForward(naked: number, gearPct: number, otherPct: number): number {
  const otherClamped = Math.max(0, otherPct);
  return (naked * (1 + otherClamped + gearPct)) / (1 + otherClamped);
}

function sharedReverse(geared: number, gearPct: number, otherPct: number): number {
  const otherClamped = Math.max(0, otherPct);
  const den = 1 + otherClamped + gearPct;
  return den > 1e-9 ? (geared * (1 + otherClamped)) / den : geared;
}

/**
 * Apply gear onto a naked (unequipped) sheet.
 * Ataque is flat; Energia multiplies (no sheet-ability energy % today).
 * Speed/crit/pen/CDR use the shared pool with `other` (sheet abilities).
 * Items never roll crit damage.
 */
export function applyGear(
  naked: SheetStats,
  loadout: Loadout,
  other: SheetOtherPct = emptySheetOther(),
): SheetStats {
  const bonuses = sumGearBonuses(loadout);
  return {
    attack: naked.attack + bonuses.dmgFlat,
    energy: naked.energy * (1 + bonuses.energyPct),
    speed: sharedForward(naked.speed, bonuses.speedPct, other.speed),
    critChance: sharedForward(naked.critChance, bonuses.critPct, other.critChance),
    critDmg: naked.critDmg,
    penetration: sharedForward(naked.penetration, bonuses.penPct, other.penetration),
    cdr: sharedForward(naked.cdr, bonuses.cdrPct, other.cdr),
    luck: sharedForward(naked.luck, bonuses.luckPct, 0),
  };
}

/** Reverse gear: recover naked sheet from an observed geared sheet + loadout. */
export function reverseGear(
  geared: SheetStats,
  loadout: Loadout,
  other: SheetOtherPct = emptySheetOther(),
): SheetStats {
  const bonuses = sumGearBonuses(loadout);
  const div = (value: number, percent: number) => (percent > -0.999 ? value / (1 + percent) : value);
  return {
    attack: geared.attack - bonuses.dmgFlat,
    energy: div(geared.energy, bonuses.energyPct),
    speed: sharedReverse(geared.speed, bonuses.speedPct, other.speed),
    critChance: sharedReverse(geared.critChance, bonuses.critPct, other.critChance),
    critDmg: geared.critDmg,
    penetration: sharedReverse(geared.penetration, bonuses.penPct, other.penetration),
    cdr: sharedReverse(geared.cdr, bonuses.cdrPct, other.cdr),
    luck: sharedReverse(geared.luck, bonuses.luckPct, 0),
  };
}

/**
 * Project an observed geared sheet onto an alternate loadout.
 * reverse → apply keeps the sheet-implied naked fixed, so identical loadouts
 * always yield the same geared sheet (0% gear-compare delta) even when the
 * typed sheet does not exactly match `applyGear(naked, loadout)`.
 */
export function projectGearedOntoLoadout(
  geared: SheetStats,
  fromLoadout: Loadout,
  toLoadout: Loadout,
  other: SheetOtherPct = emptySheetOther(),
): SheetStats {
  return applyGear(reverseGear(geared, fromLoadout, other), toLoadout, other);
}

/**
 * Project naked → sheet with gear + simulated points in one shared Σ:
 * sheet = naked × (1 + other + gear + pts×perPt) / (1 + other).
 * Attack points use +10 × levelPowerMult(level) × starsMult(stars) (see attackPointGain).
 */
export function applyPoints(
  naked: SheetStats,
  loadout: Loadout,
  pts: PointAlloc,
  other: SheetOtherPct = emptySheetOther(),
  level = 1,
  stars = 0,
): SheetStats {
  const bonuses = sumGearBonuses(loadout);
  const gem = 1 + bonuses.energyPct;
  const star = starsMult(stars);
  const atkPt = attackPointGain(level) * star;
  return {
    attack: naked.attack + bonuses.dmgFlat + pts.attack * atkPt,
    energy: naked.energy * gem + pts.energy * POINT_GAIN.energyNative * gem * star,
    speed: sharedForward(
      naked.speed,
      bonuses.speedPct + pts.speed * POINT_GAIN.speedPctOfBase,
      other.speed,
    ),
    critChance: sharedForward(
      naked.critChance,
      bonuses.critPct + pts.critChance * POINT_GAIN.critChancePctOfBase,
      other.critChance,
    ),
    critDmg: sharedForward(
      naked.critDmg,
      pts.critDmg * POINT_GAIN.critDmgPctOfBase,
      other.critDmg,
    ),
    penetration: sharedForward(
      naked.penetration,
      bonuses.penPct + pts.penetration * POINT_GAIN.penetrationPctOfBase,
      other.penetration,
    ),
    cdr: sharedForward(
      naked.cdr,
      bonuses.cdrPct + pts.cdr * POINT_GAIN.cdrPctOfBase,
      other.cdr,
    ),
    luck: sharedForward(
      naked.luck,
      bonuses.luckPct + pts.luck * POINT_GAIN.luckPctOfBase,
      0,
    ),
  };
}

/**
 * Recover naked from a sheet that already includes gear + spent points (+ sheet abilities in `other`).
 */
export function reverseSheet(
  sheet: SheetStats,
  loadout: Loadout,
  pts: PointAlloc,
  other: SheetOtherPct = emptySheetOther(),
  level = 1,
  stars = 0,
): SheetStats {
  const bonuses = sumGearBonuses(loadout);
  const eGear = 1 + bonuses.energyPct;
  const energyCore = bonuses.energyPct > -0.999 ? sheet.energy / eGear : sheet.energy;
  const star = starsMult(stars);
  const atkPt = attackPointGain(level) * star;
  return {
    attack: sheet.attack - bonuses.dmgFlat - pts.attack * atkPt,
    energy: energyCore - pts.energy * POINT_GAIN.energyNative * star,
    speed: sharedReverse(
      sheet.speed,
      bonuses.speedPct + pts.speed * POINT_GAIN.speedPctOfBase,
      other.speed,
    ),
    critChance: sharedReverse(
      sheet.critChance,
      bonuses.critPct + pts.critChance * POINT_GAIN.critChancePctOfBase,
      other.critChance,
    ),
    critDmg: sharedReverse(
      sheet.critDmg,
      pts.critDmg * POINT_GAIN.critDmgPctOfBase,
      other.critDmg,
    ),
    penetration: sharedReverse(
      sheet.penetration,
      bonuses.penPct + pts.penetration * POINT_GAIN.penetrationPctOfBase,
      other.penetration,
    ),
    cdr: sharedReverse(
      sheet.cdr,
      bonuses.cdrPct + pts.cdr * POINT_GAIN.cdrPctOfBase,
      other.cdr,
    ),
    luck: sharedReverse(
      sheet.luck,
      bonuses.luckPct + pts.luck * POINT_GAIN.luckPctOfBase,
      0,
    ),
  };
}

export function emptySheet(): SheetStats {
  return {
    attack: 0,
    energy: 0,
    speed: 0,
    critChance: 0,
    critDmg: 0,
    penetration: 0,
    cdr: 0,
    luck: 0,
  };
}
