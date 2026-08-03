import { computeAdvisorPipeline } from '@/shared/domain/advisor-pipeline';
import { computeHeroPhaseFit } from '@/shared/domain/phase-intel';
import type { HeroRecord, AccountShared } from '@/shared/lib/storage';

export type RosterDpsRow = {
  heroId: string;
  heroName: string;
  dps: number;
};

export type RosterDpsInput = {
  heroes: HeroRecord[];
  account: AccountShared;
  phase: number;
  mitigationPct: number;
};

function pipelineForHero(
  hero: HeroRecord,
  account: AccountShared,
  phase: number,
  mitigationPct: number,
) {
  const context = account.context;
  return computeAdvisorPipeline({
    naked: hero.naked,
    geared: hero.gearedOverride,
    loadout: hero.loadout,
    altLoadout: hero.altLoadout,
    pts: hero.pts,
    abilities: hero.abilities,
    rarity: hero.rarity,
    level: hero.level,
    stars: hero.stars,
    treeDanoTotal: account.tree.danoTotal,
    treeCritChance: account.tree.critChance,
    treeCritDmg: account.tree.critDmg,
    treeSpeed: account.tree.speed,
    treeEnergy: account.tree.energy,
    treeGlassCannon: account.tree.glassCannon,
    treeTempoDobrado: account.tree.tempoDobrado,
    treeLuckFlatPct: account.tree.luckFlatPct ?? 0,
    teamBuffs: account.teamBuffs,
    houseIdx: context.houseIdx,
    houseLevel: context.houseLevel,
    phase,
    mitigationPct,
    rankMode: context.rankMode,
    targetProp: context.targetProp,
    birth: hero.birth,
  });
}

/** Solo sustained DPS for one hero using shared account context. */
export function computeHeroSoloDps(
  hero: HeroRecord,
  account: AccountShared,
  phase: number,
  mitigationPct: number,
): number {
  return pipelineForHero(hero, account, phase, mitigationPct).dps;
}

/** Top N heroes by solo DPS (default 9). */
export function rankRosterByDps(input: RosterDpsInput, limit = 9): RosterDpsRow[] {
  const rows = input.heroes.map((hero) => ({
    heroId: hero.id,
    heroName: hero.name,
    dps: computeHeroSoloDps(hero, input.account, input.phase, input.mitigationPct),
  }));
  rows.sort((left, right) => right.dps - left.dps);
  return rows.slice(0, limit);
}

export function sumTopDps(rows: RosterDpsRow[]): number {
  return rows.reduce((sum, row) => sum + row.dps, 0);
}

export function listHeroesWithResetAdvice(
  heroes: HeroRecord[],
  account: AccountShared,
  phase: number,
  mitigationPct: number,
): { heroId: string; heroName: string; level: number }[] {
  return heroes
    .filter((hero) => pipelineForHero(hero, account, phase, mitigationPct).resetAdvice.recommend)
    .map((hero) => ({ heroId: hero.id, heroName: hero.name, level: hero.level }));
}

export function computeHeroPhaseFitFromRecord(
  hero: HeroRecord,
  account: AccountShared,
  phase: number,
  mitigationPct: number,
) {
  const out = pipelineForHero(hero, account, phase, mitigationPct);
  return computeHeroPhaseFit(
    hero.id,
    hero.name,
    out.stoneHp,
    mitigationPct,
    out.effective.penetration,
    out.avgHit,
  );
}
