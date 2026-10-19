/**
 * A sheet clamps cooldown at 80%, so a hero past it hides how many points it spent there; the
 * stored Power does not carry that clamp. The witness is a runed hero whose cooldown rune lifts
 * its sheet from just under the cap to over it: stripping the rune off the clamped 80% reads a
 * lower cooldown than the game scored, the recovered points fall short of the level's budget, and
 * the rebuilt Power sits ~2% under the stored one.
 *
 * Constructed from one live-read hero's birth roll (rune-free cooldown ~76.6% on 337 points) so
 * the figures stay in the range a real account reaches; the gear and tree are taken out, so the
 * cooldown points are spent heavier than that hero's.
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth, type BirthStats, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { emptySheetOther } from '@bombfarm/domain/gear';
import { gamePower, gamePowerInputOf } from '@bombfarm/domain/game-power';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { SHEET_KEYS, ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { STAT_CAPS } from '@bombfarm/domain/model/rarity-constants';
import type { HeroRune } from '@bombfarm/domain/runes';
import type { SheetStats } from '@bombfarm/domain/gear/types';

const BIRTH: BirthStats = {
  attack: 395.6852277058188,
  energy: 265.7863099040583,
  speed: 54.09546131706251,
  penetration: 3.6502821089242428,
  critChance: 10.34066957348979,
  cdr: 5.782277088391102,
  critDmg: 74.76008663309703,
  luck: 8.473723284383403,
};
const LEVEL = 337;
const STARS = 3;
const NO_TREE: TreeSheetTotals = { danoStatic: 1, energyPct: 0, speedPct: 0, critChancePct: 0, critDmgPct: 0, luckFlatPct: 0 };
const CDR_RUNE: HeroRune = { axis: 'cdr', strengthPct: 5, playSecondsLeft: 3600, rarity: 0 };
const AMPLA = 20;

function compose(runes: readonly HeroRune[]) {
  return composeSheetFromBirth({
    birth: BIRTH,
    level: LEVEL,
    stars: STARS,
    sheetOther: emptySheetOther(),
    loadout: {},
    pts: { ...ZERO_PTS(), critDmg: 10, cdr: 327 },
    tree: NO_TREE,
    runes,
  });
}

const runeFree = compose([]);
const runed = compose([CDR_RUNE]);
const observed: SheetStats = { ...runed, cdr: Math.min(runed.cdr, STAT_CAPS.cdr), critChance: Math.min(runed.critChance, STAT_CAPS.critChance) };
const storedPower = gamePower(gamePowerInputOf(runeFree, { explosao_ampla: AMPLA }));

function infer(withPower: boolean) {
  return inferSpentPoints({
    birth: BIRTH,
    level: LEVEL,
    stars: STARS,
    sheetOther: emptySheetOther(),
    loadout: {},
    tree: NO_TREE,
    sheet: observed,
    statPointsAvailable: 0,
    runes: [CDR_RUNE],
    power: withPower ? { stored: storedPower, explosaoAmplaLevel: AMPLA } : undefined,
  });
}

describe('cooldown points hidden by the sheet cap', () => {
  it('non-vacuity: the rune-free cooldown is under the cap, the runed one over it', () => {
    expect(runeFree.cdr).toBeGreaterThan(70);
    expect(runeFree.cdr).toBeLessThan(STAT_CAPS.cdr);
    expect(runed.cdr).toBeGreaterThan(STAT_CAPS.cdr);
  });

  it('the clamped sheet alone under-recovers the cooldown points', () => {
    const { pts } = infer(false);
    expect(pts.cdr).toBeLessThan(327);
  });

  it('the stored Power recovers them, and the vector lands on the level budget', () => {
    const { pts, issues } = infer(true);
    expect(pts.cdr).toBe(327);
    expect(SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0)).toBe(LEVEL);
    expect(issues).toEqual([]);
  });

  it('a Power figure that is not this sheet’s leaves the clamped reading alone', () => {
    const wrong = { stored: storedPower * 1.01234, explosaoAmplaLevel: AMPLA };
    const { pts } = inferSpentPoints({
      birth: BIRTH,
      level: LEVEL,
      stars: STARS,
      sheetOther: emptySheetOther(),
      loadout: {},
      tree: NO_TREE,
      sheet: observed,
      statPointsAvailable: 0,
      runes: [CDR_RUNE],
      power: wrong,
    });
    expect(pts.cdr).toBe(infer(false).pts.cdr);
  });
});
