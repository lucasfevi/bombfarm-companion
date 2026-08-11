/* QUARANTINED (catalog v4, 2026-08-11): the assertions below are anchored to in-game
 * captures taken under the pre-v4 balance, on an account that has since been wiped —
 * they cannot be re-baselined without replacing game observations with our own output.
 * Un-skip once a post-update save export lands; `inferSpentPoints`' nonIntegerPoints
 * residual then also decides the open nv50+ Dano question (see gear/catalog.ts
 * composeAttack). Do NOT edit the numbers to make these pass. */
/**
 * BSPW4-09 (BSP-60) — sheet penetration is a mitigation threshold, never a sheet clamp.
 * `save-20260801-crit-dmg-tree.json`'s Bellatrix has sheet pen 141.22613536827 — well above
 * the 100 mitigation-bypass threshold — and every stage of the pipeline must carry it raw.
 */
import { describe, expect, it } from 'vitest';
import {
  abilityMods,
  composeSheetFromBirth,
  inferSpentPoints,
  mitigationFactor,
  peelSheetSources,
  rankNextPoint,
  STAT_CAPS,
  type Context,
  type HeroSheet,
} from '@bombfarm/domain/model';
import { applyGear, applyPoints, emptySheetOther, reverseSheet } from '@bombfarm/domain/gear';
import { computeCombatMults, derive } from '@bombfarm/domain/derive';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

describe.skip('uncapped penetration (BSPW4-09)', () => {
  it('AC-53/AC-54/AC-55: sheet pen 141.23 survives every stage unclamped, and ranks at 0', () => {
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const bellatrix = extractHero(raw, 'Bellatrix');
    const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
    const tree = treeTotalsFromSave(totals);
    expect(bellatrix.sheet.penetration).toBeCloseTo(141.22613536827, 6);
    expect(bellatrix.birth).toBeDefined();

    const solved = inferSpentPoints({
      birth: bellatrix.birth!,
      level: bellatrix.level,
      stars: bellatrix.stars,
      sheetOther: bellatrix.sheetOther,
      loadout: bellatrix.loadout,
      tree,
      sheet: bellatrix.sheet,
      statPointsAvailable: bellatrix.statPointsAvailable,
    });

    // AC-53, stage 1: composeSheetFromBirth.
    const composed = composeSheetFromBirth({
      birth: bellatrix.birth!,
      level: bellatrix.level,
      stars: bellatrix.stars,
      sheetOther: bellatrix.sheetOther,
      loadout: bellatrix.loadout,
      pts: solved.pts,
      tree,
    });
    expect(composed.penetration, 'composeSheetFromBirth').toBeGreaterThan(100);
    expect(composed.penetration).toBeCloseTo(141.22613536827, 4);

    // AC-53, stage 2: peelSheetSources — the four lines sum to the same uncapped value.
    const peeled = peelSheetSources({
      birth: bellatrix.birth!,
      level: bellatrix.level,
      stars: bellatrix.stars,
      sheetOther: bellatrix.sheetOther,
      loadout: bellatrix.loadout,
      pts: solved.pts,
      tree,
    });
    const peeledTotal =
      peeled.penetration.hero +
      peeled.penetration.gear +
      peeled.penetration.ability +
      peeled.penetration.skillTree;
    expect(peeledTotal, 'peelSheetSources total').toBeGreaterThan(100);
    expect(peeledTotal).toBeCloseTo(141.22613536827, 4);
    // AD-BSP-22 / OQ-BSP-9: tree contributes exactly 0 to penetration.
    expect(peeled.penetration.skillTree).toBe(0);

    // AC-53, stage 3: applyGear (naked → geared, pre-points).
    const naked = composeSheetFromBirth({
      birth: bellatrix.birth!,
      level: bellatrix.level,
      stars: bellatrix.stars,
      sheetOther: bellatrix.sheetOther,
      loadout: bellatrix.loadout,
      pts: ZERO_PTS(),
      tree,
    });
    const geared = applyGear(naked, bellatrix.loadout, bellatrix.sheetOther);
    expect(geared.penetration, 'applyGear').toBeGreaterThan(100);

    // AC-53, stage 4: applyPoints (naked → sheet with gear + simulated points).
    const withPoints = applyPoints(
      naked,
      bellatrix.loadout,
      solved.pts,
      bellatrix.sheetOther,
      bellatrix.level,
      bellatrix.stars,
    );
    expect(withPoints.penetration, 'applyPoints').toBeGreaterThan(100);

    // AC-53, stage 5: reverseSheet (observed sheet → naked) — recovers a still-uncapped value.
    const reversed = reverseSheet(
      bellatrix.sheet,
      bellatrix.loadout,
      solved.pts,
      bellatrix.sheetOther,
      bellatrix.level,
      bellatrix.stars,
    );
    expect(reversed.penetration, 'reverseSheet').toBeGreaterThan(100);

    // AC-53, stages 6/7: derive's adjusted and effective.
    const mods = abilityMods(bellatrix.abilities);
    const mults = computeCombatMults({
      mods,
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: false,
      treeTempoDobrado: false,
      extraDmgPct: 0,
    });
    const context: Context = {
      restSeconds: 12 * 60,
      mitigation: 0.067,
      blastRange: 1,
      cycleModel: 'serial',
      walkDelay: 0.15,
      drainMult: 1,
    };
    const result = derive({
      geared: bellatrix.sheet,
      naked: bellatrix.sheet,
      sheetOther: emptySheetOther(),
      pts: ZERO_PTS(),
      rarity: bellatrix.rarity,
      level: bellatrix.level,
      stars: bellatrix.stars,
      attackMult: mults.attackMult,
      energyMult: mults.energyMult,
      speedMult: mults.speedMult,
      critDmgMult: mults.critDmgMult,
      teamCritPctOfBase: 0,
      treeSheet: tree,
      combatCritChancePctOfBase: 0,
      penetrationPp: mods.penetrationPp,
      context,
      dmgMult: mults.dmgMult,
      mitigationPct: 6.7,
    });
    expect(result.adjusted.penetration, 'derive.adjusted').toBeGreaterThan(100);
    expect(result.effective.penetration, 'derive.effective').toBeGreaterThan(100);
    expect(result.effective.penetration).toBeCloseTo(141.22613536827, 4);

    // AC-54: mitigationFactor still clamps penetration's DAMAGE-path contribution via clampPenPct.
    const mitAt100 = mitigationFactor(0.067, 100);
    const mitAt141 = mitigationFactor(0.067, result.effective.penetration);
    expect(mitAt141).toBeCloseTo(mitAt100, 9);
    expect(mitAt141).not.toBe(0); // damage fully bypasses mitigation at/above 100%, never below

    // AC-55: the SAME test also asserts the ranking is 0 for this hero — sheet 141.23 AND
    // rank 0 together, so a future reader cannot mistake the ranking behaviour for a clamp.
    const heroSheet: HeroSheet = {
      rarity: bellatrix.rarity,
      attack: result.effective.attack,
      energy: result.effective.energy,
      speed: result.effective.speed,
      critChance: result.effective.critChance,
      critDmg: result.effective.critDmg,
      penetration: result.effective.penetration,
      cdr: result.effective.cdr,
      attackPerPoint: result.effective.attackPerPoint,
      energyPerPoint: result.effective.energyPerPoint,
    };
    const ranking = rankNextPoint(heroSheet, context, { effectiveDeltas: result.effectiveDelta });
    const pen = ranking.find((r) => r.stat === 'penetration');
    expect(pen?.dpsGainPct).toBe(0);
  });

  it('AC-49/AC-50: crit chance at 100 and cdr at 80 score exactly 0 and are never ranking[0] while another stat scores > 0', () => {
    const hero: HeroSheet = {
      rarity: 'Raro',
      attack: 400,
      energy: 500,
      speed: 55,
      critChance: STAT_CAPS.critChance,
      critDmg: 80,
      penetration: 8,
      cdr: STAT_CAPS.cdr,
      attackPerPoint: 10,
      energyPerPoint: 8,
    };
    const context: Context = {
      restSeconds: 12 * 60,
      mitigation: 0.067,
      blastRange: 1,
      cycleModel: 'serial',
      walkDelay: 0.15,
      drainMult: 1,
    };
    const ranking = rankNextPoint(hero, context, {
      effectiveDeltas: { attack: 10, energy: 8, speed: 1, critChance: 2, critDmg: 8, penetration: 0.5, cdr: 1 },
    });
    const crit = ranking.find((r) => r.stat === 'critChance');
    const cdr = ranking.find((r) => r.stat === 'cdr');
    expect(crit?.dpsGainPct).toBe(0);
    expect(cdr?.dpsGainPct).toBe(0);
    expect(ranking[0].stat).not.toBe('critChance');
    expect(ranking[0].stat).not.toBe('cdr');
    expect(ranking[0].dpsGainPct).toBeGreaterThan(0);
  });
});
