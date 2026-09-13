/**
 * Ponta de Diamante adds FLAT penetration points, held outside the pool that gear and spent
 * points scale — the shape the 2026-09-02 patch gave it ("os pontos de Penetração agora são
 * adicionados diretamente"). Until then it multiplied the roll (×21 at rank 20), and the
 * 2026-08-25 capture's IDK still reproduces under that reading — which is why that capture sits
 * behind the `penetration` boundary in the regime registry.
 *
 * The witness is one hero off the 2026-09-13 live read, excerpted here so the claim does not wait
 * on the whole read landing with the rune work it also carries: Minato, ★2, rank-20 Ponta, eight
 * items whose penetration rolls multiply his roll ~5×. The game exports 64.118 for him. With the
 * ability held out and no penetration points the sheet composes to 44.118 — a residual of exactly
 * 20, so the addend is neither star-scaled (★2 would make it 30) nor inside the pool (his gear
 * would make it ~106). Minato's three runed axes (energy, crit damage, cooldown) are deliberately
 * not asserted here; penetration is not one of them.
 */
import { describe, expect, it } from 'vitest';
import { nakedFromBirth, type BirthStats, type TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { applyGear, emptySheetOther, sumGearBonuses } from '@bombfarm/domain/gear';
import type { Loadout } from '@bombfarm/domain/gear/types';
import { abilityMods } from '@bombfarm/domain/model';
import { inferSpentPoints } from '@bombfarm/domain/point-inference';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';

const MINATO = {
  level: 123,
  stars: 2,
  birth: {
    attack: 304.7389606887333,
    energy: 276.26697496750586,
    speed: 53.63581756324113,
    penetration: 5.566270642446929,
    critChance: 7.391785804331767,
    cdr: 2.918451686696665,
    critDmg: 86.76532135855398,
    luck: 11.048294459517157,
  } satisfies BirthStats,
  loadout: {
    arma: { defId: 'ash_arma', rarityIdx: 1, level: 80, upgrade: 14 },
    elmo: { defId: 'wooden_elmo', rarityIdx: 1, level: 110, upgrade: 13 },
    anel: { defId: 'autumn_anel', rarityIdx: 3, level: 50, upgrade: 13 },
    amuleto: { defId: 'autumn_amuleto', rarityIdx: 3, level: 50, upgrade: 13 },
    peito: { defId: 'autumn_peito', rarityIdx: 3, level: 50, upgrade: 13 },
    calca: { defId: 'glacier_calca', rarityIdx: 2, level: 60, upgrade: 13 },
    luva: { defId: 'wooden_luva', rarityIdx: 0, level: 110, upgrade: 13 },
    bota: { defId: 'forest_bota', rarityIdx: 1, level: 100, upgrade: 13 },
  } satisfies Loadout,
  exportedPenetration: 64.11826111203436,
};

const NO_TREE: TreeSheetTotals = { danoStatic: 1, energyPct: 0, speedPct: 0, critChancePct: 0, critDmgPct: 0, luckFlatPct: 0 };

const sheetOther = { ...emptySheetOther(), penetration: abilityMods({ ponta_diamante: 20 }).sheetPenetrationFlat };

describe('Ponta de Diamante is a flat addend outside the gear/points pool', () => {
  it('non-vacuity: the witness wears gear that multiplies his roll several times over', () => {
    expect(sheetOther.penetration).toBe(20);
    expect(sumGearBonuses(MINATO.loadout).penPct).toBeGreaterThan(4);
  });

  it('the naked sheet is the star-scaled roll plus the points — not the roll times 21', () => {
    const naked = nakedFromBirth(MINATO.birth, MINATO.level, MINATO.stars, sheetOther);
    expect(naked.penetration).toBeCloseTo(MINATO.birth.penetration * 1.5 + 20, 12);
    expect(naked.penetration).not.toBeCloseTo(MINATO.birth.penetration * 1.5 * 21, 0);
  });

  it('composing the export back: gear scales the roll alone, and the +20 survives untouched', () => {
    const naked = nakedFromBirth(MINATO.birth, MINATO.level, MINATO.stars, sheetOther);
    const geared = applyGear(naked, MINATO.loadout, sheetOther);
    const relative = Math.abs(geared.penetration - MINATO.exportedPenetration) / MINATO.exportedPenetration;
    expect(relative).toBeLessThan(1e-9);

    const withoutAbility = applyGear(
      nakedFromBirth(MINATO.birth, MINATO.level, MINATO.stars, emptySheetOther()),
      MINATO.loadout,
      emptySheetOther(),
    );
    expect(MINATO.exportedPenetration - withoutAbility.penetration).toBeCloseTo(20, 9);
  });

  it('inverting the export recovers zero penetration points with no issue on that key', () => {
    const naked = nakedFromBirth(MINATO.birth, MINATO.level, MINATO.stars, sheetOther);
    const sheet = applyGear(naked, MINATO.loadout, sheetOther);
    const inferred = inferSpentPoints({
      birth: MINATO.birth,
      level: MINATO.level,
      stars: MINATO.stars,
      sheetOther,
      loadout: MINATO.loadout,
      tree: NO_TREE,
      sheet,
      statPointsAvailable: MINATO.level,
    });
    expect(inferred.pts.penetration).toBe(0);
    expect(inferred.issues.filter((issue) => 'key' in issue && issue.key === 'penetration')).toEqual([]);
    expect(inferred.pts).toEqual(ZERO_PTS());
  });
});
