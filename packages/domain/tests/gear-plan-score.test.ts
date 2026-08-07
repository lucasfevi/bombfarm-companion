import { describe, expect, it, vi } from 'vitest';
import * as advisorPipeline from '@bombfarm/domain/advisor-pipeline';
import * as deriveModule from '@bombfarm/domain/derive';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { stackTeamBonusMult, TEAM_MULT_BONUS_CAP } from '@bombfarm/domain/derive';
import { zeroTeamBuffs, type TeamBuffId } from '@bombfarm/domain/team-buffs';
import { PROPS } from '@bombfarm/domain/phases';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import {
  createScoreMemo,
  scoreHeroLoadout,
} from '@bombfarm/domain/gear-plan/score';
import type { FarmContext, HeroPlanContext } from '@bombfarm/domain/gear-plan/types';
import {
  extractHero,
  loadFixtureJson,
  treeTotalsFromSave,
} from './helpers/sheet-math-fixtures';
import { buildHeroPlanContext } from '@bombfarm/domain/gear-plan/hero-context';
import type { GearPlanAccountInput, GearPlanHeroInput } from '@bombfarm/domain/gear-plan/types';

function accountFromFixture(raw: Record<string, unknown>): GearPlanAccountInput {
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const treeSheet = treeTotalsFromSave(totals);
  return {
    treeSheet,
    treeGlassCannon: false,
    treeTempoDobrado: false,
    houseIdx: 0,
    houseLevel: 1,
    phase: 1,
    mitigationPct: 6.7,
    slots: 6,
  };
}

function farmFromAccount(account: GearPlanAccountInput): FarmContext {
  return {
    houseIdx: account.houseIdx,
    houseLevel: account.houseLevel,
    phase: account.phase,
    mitigationPct: account.mitigationPct,
    treeGlassCannon: account.treeGlassCannon,
    treeTempoDobrado: account.treeTempoDobrado,
  };
}

function heroInputFromExtract(hero: ReturnType<typeof extractHero>): GearPlanHeroInput {
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

describe('scoreHeroLoadout', () => {
  it('does not call computeAdvisorPipeline during scoring', () => {
    const spy = vi.spyOn(advisorPipeline, 'computeAdvisorPipeline');
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const hero = extractHero(raw, 'Bellatrix', 62);
    const account = accountFromFixture(raw);
    const ctx = buildHeroPlanContext(heroInputFromExtract(hero), account, 'optimize')!;
    scoreHeroLoadout(ctx, hero.loadout, ZERO_PTS(), zeroTeamBuffs(), farmFromAccount(account));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('folego_mineiro in auras yields strictly higher duty than zero auras (AD-RGO-27)', () => {
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const hero = extractHero(raw, 'Bellatrix', 62);
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
      sheetOther: { speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0 },
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
        critDmgMult: 1,
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
      treeGlassCannon: false,
      treeTempoDobrado: false,
    };
    const score = scoreHeroLoadout(ctx, {}, ZERO_PTS(), zeroTeamBuffs(), farm);
    expect(score.duty).toBe(0);
    expect(Number.isNaN(score.duty)).toBe(false);
    expect(Number.isNaN(score.sustained)).toBe(false);
    expect(Number.isNaN(score.active)).toBe(false);
  });

  it('sustained matches computeAdvisorPipeline dps for fixture hero with matching auras', () => {
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const hero = extractHero(raw, 'Bellatrix', 62);
    const account = accountFromFixture(raw);
    const ctx = buildHeroPlanContext(heroInputFromExtract(hero), account, 'optimize')!;
    const teamBuffs = zeroTeamBuffs();
    const pipeline = computeAdvisorPipeline({
      naked: hero.sheet,
      geared: hero.sheet,
      loadout: hero.loadout,
      altLoadout: null,
      pts: ZERO_PTS(),
      abilities: hero.abilities,
      rarity: hero.rarity,
      level: hero.level,
      stars: hero.stars,
      treeDanoTotal: account.treeSheet.danoStatic,
      treeCritChance: account.treeSheet.critChancePct,
      treeCritDmg: account.treeSheet.critDmgPct,
      treeSpeed: account.treeSheet.speedPct,
      treeEnergy: account.treeSheet.energyPct,
      treeGlassCannon: account.treeGlassCannon,
      treeTempoDobrado: account.treeTempoDobrado,
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
    const raw = loadFixtureJson('save-20260801-crit-dmg-tree.json');
    const hero = extractHero(raw, 'Bellatrix', 62);
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
});
