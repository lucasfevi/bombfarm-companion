import { computeAdvisorPipeline } from './advisor-pipeline';
import { DEFAULT_CASA_SLOTS } from './casa-slots';
import { computeHeroPhaseFit } from './phase-intel';
import type { HeroRecord, AccountShared } from './shims/storage';

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

/** Top heroes by solo DPS — limit defaults to {@link DEFAULT_CASA_SLOTS}. */
export function rankRosterByDps(input: RosterDpsInput, limit = DEFAULT_CASA_SLOTS): RosterDpsRow[] {
  const effectiveLimit = arguments.length >= 2 ? limit : (input.account.slots ?? limit);
  const clampedLimit = Number.isFinite(effectiveLimit) && effectiveLimit >= 1 ? Math.round(effectiveLimit) : 1;
  const rows = input.heroes.map((hero) => ({
    heroId: hero.id,
    heroName: hero.name,
    dps: computeHeroSoloDps(hero, input.account, input.phase, input.mitigationPct),
  }));
  rows.sort((left, right) => right.dps - left.dps);
  return rows.slice(0, clampedLimit);
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
    .filter((hero) => hero.battleAllowed !== false)
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
