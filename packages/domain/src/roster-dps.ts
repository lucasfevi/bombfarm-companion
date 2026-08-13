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

/**
 * The only `HeroRecord`-shaped entry to `computeAdvisorPipeline` (`AD-032`). Exported so a
 * second surface (the desktop renderer, MP3 F2) maps a `HeroRecord` to advice through this one
 * function instead of assembling its own `AdvisorPipelineInput` — one mapping, not two.
 *
 * `AD-038`: this function does not forward `account.tree.critDmgMult` the way
 * `advisor-selectors.ts`'s `selectAdvisorPipeline` forwards `state.treeCritDmgMult`.
 * `advisor-pipeline-sheets.ts` resolves the omission as
 * `critDmgMult: treeCritDmgMult ?? (treeGlassCannon ? 2 : 1)`, so this path and the web's agree
 * only when the account's real `crit_dmg_mult` is `1` or `2` (every account observed so far).
 * The gap is pinned, not fixed, by `tools/advisor-input-parity.test.mjs` — forwarding the field
 * here would change `apps/web`'s rendered roster DPS, team-plan scorer and reset-advice banner,
 * and a math change cannot be proven web-neutral by an empty diff.
 */
export function pipelineForHero(
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
    statPointsAvailable: hero.statPointsAvailable ?? 0,
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

/** Top heroes by solo DPS — an omitted `limit` falls back to `account.slots`, then {@link DEFAULT_CASA_SLOTS}. */
export function rankRosterByDps(input: RosterDpsInput, limit?: number): RosterDpsRow[] {
  const effectiveLimit = limit ?? input.account.slots ?? DEFAULT_CASA_SLOTS;
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
