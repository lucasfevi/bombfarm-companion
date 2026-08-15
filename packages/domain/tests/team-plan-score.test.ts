import { describe, expect, it, vi } from 'vitest';
import * as advisorPipeline from '@bombfarm/domain/advisor-pipeline';
import * as deriveModule from '@bombfarm/domain/derive';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { stackTeamBonusMult, TEAM_MULT_BONUS_CAP } from '@bombfarm/domain/derive';
import { zeroTeamBuffs, type TeamBuffId } from '@bombfarm/domain/team-buffs';
import { PROPS } from '@bombfarm/domain/phases';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import type { PointAlloc } from '@bombfarm/domain/gear/types';
import {
  createScoreMemo,
  scoreHeroLoadout,
} from '@bombfarm/domain/team-plan/score';
import type { FarmContext, HeroPlanContext } from '@bombfarm/domain/team-plan/types';
import {
  extractHero,
  loadFixtureJson,
  treeTotalsFromSave,
} from './helpers/sheet-math-fixtures';
import { buildHeroPlanContext } from '@bombfarm/domain/team-plan/hero-context';
import type { TeamPlanAccountInput, TeamPlanHeroInput } from '@bombfarm/domain/team-plan/types';

function accountFromFixture(raw: Record<string, unknown>): TeamPlanAccountInput {
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const treeSheet = treeTotalsFromSave(totals);
  return {
    treeSheet,
        houseIdx: 0,
    houseLevel: 1,
    phase: 1,
    mitigationPct: 6.7,
    slots: 6,
    fieldSlots: 6,
  };
}

function farmFromAccount(account: TeamPlanAccountInput): FarmContext {
  return {
    houseIdx: account.houseIdx,
    houseLevel: account.houseLevel,
    phase: account.phase,
    mitigationPct: account.mitigationPct,
      };
}

function heroInputFromExtract(hero: ReturnType<typeof extractHero>): TeamPlanHeroInput {
  return {
    heroId: hero.sourceId,
    name: hero.name,
    level: hero.level,
    stars: hero.stars,
    rarity: hero.rarity,
    birth: hero.birth,
    abilities: hero.abilities,
    pts: ZERO_PTS(),
    loadout: hero.loadout,
  };
}

// MP5 F1 (AD-068 class (b) — structural): re-pointed onto save-20260813-5heroes.json's
// Bellatrix (L42, not the deleted crit-dmg-tree fixture's L62). Every fixture-backed assertion
// here compares scoreHeroLoadout against an independently-computed reference (a spy call count,
// or computeAdvisorPipeline / composeSheetFromBirth run on the same inputs) — none pins a
// captured numeric value.
describe('scoreHeroLoadout', () => {
  it('does not call computeAdvisorPipeline during scoring', () => {
    const spy = vi.spyOn(advisorPipeline, 'computeAdvisorPipeline');
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const hero = extractHero(raw, 'Bellatrix', 42);
    const account = accountFromFixture(raw);
    const ctx = buildHeroPlanContext(heroInputFromExtract(hero), account, 'optimize')!;
    scoreHeroLoadout(ctx, hero.loadout, ZERO_PTS(), zeroTeamBuffs(), farmFromAccount(account));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('folego_mineiro in auras yields strictly higher duty than zero auras (AD-RGO-27)', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const hero = extractHero(raw, 'Bellatrix', 42);
    const account = accountFromFixture(raw);
    const ctx = buildHeroPlanContext(heroInputFromExtract(hero), account, 'optimize')!;
    const farm = farmFromAccount(account);
    const noAura = scoreHeroLoadout(ctx, hero.loadout, ZERO_PTS(), zeroTeamBuffs(), farm);
    const withFolego: Record<TeamBuffId, number> = { ...zeroTeamBuffs(), folego_mineiro: 50 };
    const withAura = scoreHeroLoadout(ctx, hero.loadout, ZERO_PTS(), withFolego, farm);
    expect(withAura.duty).toBeGreaterThan(noAura.duty);
  });

  it('duty is 0 with no NaN when effective energy is 0', () => {
    const ctx: HeroPlanContext = {
      heroId: 'z',
      name: 'Zero',
      level: 10,
      stars: 0,
      rarity: 'Comum',
      birth: {
        attack: 100,
        energy: 0,
        speed: 50,
        critChance: 10,
        critDmg: 50,
        penetration: 0,
        cdr: 0,
        luck: 0,
      },
      sheetOther: { speed: 0, critChance: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
      mods: {
        drainMult: 1,
        combatCritChancePctOfBase: 0,
        penetrationPp: 0,
        rangeCells: 0,
        dmgMult: 1,
        attackMult: 1,
        speedMult: 1,
        gateAttackMult: 1,
        sheetCritChancePctOfBase: 0,
        sheetPenetrationRaw: 0,
        sheetCritDmgPctOfBase: 0,
      },
      treeSheet: {
        danoStatic: 1,
        energyPct: 0,
        speedPct: 0,
        critChancePct: 0,
        critDmgPct: 0,
        luckFlatPct: 0,
      },
      scope: 'optimize',
      abilities: {},
      pts: ZERO_PTS(),
    };
    const farm: FarmContext = {
      houseIdx: 0,
      houseLevel: 1,
      phase: 1,
      mitigationPct: 6.7,
          };
    const score = scoreHeroLoadout(ctx, {}, ZERO_PTS(), zeroTeamBuffs(), farm);
    expect(score.duty).toBe(0);
    expect(Number.isNaN(score.duty)).toBe(false);
    expect(Number.isNaN(score.sustained)).toBe(false);
    expect(Number.isNaN(score.active)).toBe(false);
  });

  it('sustained matches computeAdvisorPipeline dps for fixture hero with matching auras', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const hero = extractHero(raw, 'Bellatrix', 42);
    const account = accountFromFixture(raw);
    const ctx = buildHeroPlanContext(heroInputFromExtract(hero), account, 'optimize')!;
    const teamBuffs = zeroTeamBuffs();
    const pipeline = computeAdvisorPipeline({
      naked: hero.sheet,
      geared: hero.sheet,
      loadout: hero.loadout,
      altLoadout: null,
      pts: ZERO_PTS(),
      statPointsAvailable: 0,
      abilities: hero.abilities,
      rarity: hero.rarity,
      level: hero.level,
      stars: hero.stars,
      treeDanoTotal: account.treeSheet.danoStatic,
      treeCritChance: account.treeSheet.critChancePct,
      treeCritDmg: account.treeSheet.critDmgPct,
      treeSpeed: account.treeSheet.speedPct,
      treeEnergy: account.treeSheet.energyPct,
            treeLuckFlatPct: account.treeSheet.luckFlatPct,
      teamBuffs,
      houseIdx: account.houseIdx,
      houseLevel: account.houseLevel,
      phase: account.phase,
      mitigationPct: account.mitigationPct,
      rankMode: 'dps',
      targetProp: PROPS[1]?.name ?? PROPS[0].name,
      birth: hero.birth,
    });
    const scored = scoreHeroLoadout(
      ctx,
      hero.loadout,
      ZERO_PTS(),
      teamBuffs,
      farmFromAccount(account),
    );
    expect(scored.sustained).toBeCloseTo(pipeline.dps, 9);
  });

  it('memo avoids duplicate derive work on identical inputs', () => {
    const deriveSpy = vi.spyOn(deriveModule, 'derive');
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const hero = extractHero(raw, 'Bellatrix', 42);
    const account = accountFromFixture(raw);
    const ctx = buildHeroPlanContext(heroInputFromExtract(hero), account, 'optimize')!;
    const farm = farmFromAccount(account);
    const memo = createScoreMemo();
    const auras = zeroTeamBuffs();
    scoreHeroLoadout(ctx, hero.loadout, ZERO_PTS(), auras, farm, memo);
    scoreHeroLoadout(ctx, hero.loadout, ZERO_PTS(), auras, farm, memo);
    expect(deriveSpy).toHaveBeenCalledTimes(1);
    deriveSpy.mockRestore();
  });

  // Regression for the double-counted-points bug: `scoreHeroLoadout` used to compose its
  // `geared` sheet with the REAL `pts` and then hand that same `pts` to `derive()`, which
  // adds `pts * delta` on top — every spent point counted twice. With all combat multipliers
  // neutral (no team auras, no ability mods), `scoreHeroLoadout`'s effective
  // sheet must equal `composeSheetFromBirth`'s sheet for the SAME non-zero pts exactly once —
  // matching the `sheetsFromBirth` / import-save `gearedOverride` contract `derive()` documents.
  it('counts spent points exactly once (no double-count vs composeSheetFromBirth)', () => {
    const pts: PointAlloc = {
      attack: 12,
      energy: 3,
      speed: 4,
      critChance: 2,
      critDmg: 5,
      penetration: 1,
      cdr: 1,
      luck: 0,
    };
    const ctx: HeroPlanContext = {
      heroId: 'pt-dbl-count',
      name: 'PointDoubleCount',
      level: 40,
      stars: 3,
      rarity: 'Épico',
      birth: {
        attack: 200,
        energy: 500,
        speed: 60,
        critChance: 15,
        critDmg: 60,
        penetration: 5,
        cdr: 10,
        luck: 2,
      },
      sheetOther: { speed: 0, critChance: 0, critDmgFlat: 0, penetration: 0, cdr: 0 },
      mods: {
        drainMult: 1,
        combatCritChancePctOfBase: 0,
        penetrationPp: 0,
        rangeCells: 0,
        dmgMult: 1,
        attackMult: 1,
        speedMult: 1,
        gateAttackMult: 1,
        sheetCritChancePctOfBase: 0,
        sheetPenetrationRaw: 0,
        sheetCritDmgPctOfBase: 0,
      },
      treeSheet: {
        danoStatic: 1,
        energyPct: 0,
        speedPct: 0,
        critChancePct: 0,
        critDmgPct: 0,
        luckFlatPct: 0,
      },
      scope: 'optimize',
      abilities: {},
      pts,
    };
    const farm: FarmContext = {
      houseIdx: 0,
      houseLevel: 1,
      phase: 1,
      mitigationPct: 6.7,
          };

    const expectedSheet = composeSheetFromBirth({
      birth: ctx.birth,
      level: ctx.level,
      stars: ctx.stars,
      sheetOther: ctx.sheetOther,
      loadout: {},
      pts,
      tree: ctx.treeSheet,
    });

    const score = scoreHeroLoadout(ctx, {}, pts, zeroTeamBuffs(), farm);

    expect(score.effective.attack).toBeCloseTo(expectedSheet.attack, 6);
    expect(score.effective.energy).toBeCloseTo(expectedSheet.energy, 6);
    expect(score.effective.speed).toBeCloseTo(expectedSheet.speed, 6);
    expect(score.effective.critChance).toBeCloseTo(expectedSheet.critChance, 6);
    expect(score.effective.critDmg).toBeCloseTo(expectedSheet.critDmg, 6);
    expect(score.effective.penetration).toBeCloseTo(expectedSheet.penetration, 6);
    expect(score.effective.cdr).toBeCloseTo(expectedSheet.cdr, 6);
  });
});
