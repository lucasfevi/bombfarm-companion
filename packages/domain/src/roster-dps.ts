import { computeAdvisorPipeline } from './advisor-pipeline';
import { DEFAULT_CASA_SLOTS } from './casa-slots';
import { computeHeroPhaseFit } from './phase-intel';
import type { HeroRecord, AccountShared } from './shims/storage';

export type RosterDpsRow = {
  heroId: string;
  heroName: string;
  dps: number;
  /**
   * Pipeline-adjusted Luck, PERCENTAGE POINTS (`pipelineForHero(...).adjusted.luck` — same units
   * `farm-rate.ts`'s `heroLuckPct`/`sorteFraction` use). Carried here so a caller wanting "this
   * squad's average luck" (the web Phases board's drop-chance panel) can average the rows this
   * function already computed instead of re-running the advisor pipeline a second time per hero.
   */
  luck: number;
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
    abilities: hero.abilities,
    rarity: hero.rarity,
    level: hero.level,
    stars: hero.stars,
    treeDanoTotal: account.tree.danoTotal,
    treeCritChance: account.tree.critChance,
    treeCritDmg: account.tree.critDmg,
    treeSpeed: account.tree.speed,
    treeEnergy: account.tree.energy,
    treeLuckFlatPct: account.tree.luckFlatPct ?? 0,
    teamBuffs: account.teamBuffs,
    houseIdx: context.houseIdx,
    houseLevel: context.houseLevel,
    houseCycleSecs: account.houseCycleSecs ?? null,
    // NOT coerced with `?? null`: `undefined` (the field absent — every non-web-store account,
    // including every fixture predating this field) must reach `resolveHouseRestSeconds` as
    // `undefined` so it keeps trusting `houseCycleSecs` unconditionally, its pre-existing
    // behaviour. Only the web planner's account store populates a real anchor value here.
    houseCycleSecsHouseIdx: account.houseCycleSecsHouseIdx,
    houseCycleSecsLevel: account.houseCycleSecsLevel,
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

/**
 * Top heroes by solo DPS — an omitted `limit` falls back to `account.fieldSlots` (FIELD
 * concurrency, `skills.field_slots`), then `account.slots` (HOUSE recovery, `casa.slots` —
 * a pre-`skills.field_slots` fallback only, same `AD-063` convention as `SquadFarmFacts` in
 * `farm-rate.ts`), then {@link DEFAULT_CASA_SLOTS}. The squad this ranks is who can be ON THE
 * FIELD at once, not who the House can refill at once.
 */
export function rankRosterByDps(input: RosterDpsInput, limit?: number): RosterDpsRow[] {
  const effectiveLimit = limit ?? input.account.fieldSlots ?? input.account.slots ?? DEFAULT_CASA_SLOTS;
  const clampedLimit = Number.isFinite(effectiveLimit) && effectiveLimit >= 1 ? Math.round(effectiveLimit) : 1;
  const rows = input.heroes.map((hero) => {
    // One pipeline run per hero, not two: `computeHeroSoloDps` would call `pipelineForHero`
    // again internally for the same inputs just to read `.dps`.
    const pipeline = pipelineForHero(hero, input.account, input.phase, input.mitigationPct);
    return {
      heroId: hero.id,
      heroName: hero.name,
      dps: pipeline.dps,
      luck: pipeline.adjusted.luck,
    };
  });
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
