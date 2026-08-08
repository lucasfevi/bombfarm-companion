import { abilityMods, type AbilityMods } from '../model';
import { emptySheetOther } from '../gear';
import { composeSheetFromBirth, effectiveTreeSheetForAbisso, nakedFromBirth } from '../birth-sheet';
import type { TeamPlanAccountInput, TeamPlanHeroInput, HeroPlanContext, ScopeState } from './types';

export type TeamPlanBlocked = {
  blocked: true;
  heroNames: string[];
};

export type BuildHeroPlanContextsResult =
  | { blocked: false; contexts: HeroPlanContext[] }
  | TeamPlanBlocked;

function sheetOtherFromAbilities(abilities: Record<string, number>) {
  const mods = abilityMods(abilities);
  return {
    ...emptySheetOther(),
    critChance: mods.sheetCritChancePctOfBase / 100,
    penetration: mods.sheetPenetrationRaw,
    critDmg: mods.sheetCritDmgPctOfBase,
  };
}

export function buildHeroPlanContext(
  hero: TeamPlanHeroInput,
  account: TeamPlanAccountInput,
  scope: ScopeState,
): HeroPlanContext | null {
  if (!hero.birth) return null;
  const mods = abilityMods(hero.abilities);
  return {
    heroId: hero.heroId,
    name: hero.name,
    level: hero.level,
    stars: hero.stars,
    rarity: hero.rarity,
    birth: hero.birth,
    sheetOther: sheetOtherFromAbilities(hero.abilities),
    mods,
    treeSheet: effectiveTreeSheetForAbisso(account.treeSheet, account.treeAbisso ?? false),
    scope,
    abilities: hero.abilities,
    pts: hero.pts,
  };
}

export function buildHeroPlanContexts(
  heroes: TeamPlanHeroInput[],
  account: TeamPlanAccountInput,
  scopeByHeroId: Record<string, ScopeState>,
): BuildHeroPlanContextsResult {
  const blockedNames: string[] = [];
  const contexts: HeroPlanContext[] = [];

  for (const hero of heroes) {
    const scope = scopeByHeroId[hero.heroId] ?? (hero.battleAllowed === false ? 'donate' : 'optimize');
    if (scope === 'leaveAlone') {
      if (!hero.birth) continue;
      const ctx = buildHeroPlanContext(hero, account, scope);
      if (ctx) contexts.push(ctx);
      continue;
    }
    if (!hero.birth) {
      blockedNames.push(hero.name);
      continue;
    }
    const ctx = buildHeroPlanContext(hero, account, scope);
    if (ctx) contexts.push(ctx);
  }

  if (blockedNames.length > 0) {
    return { blocked: true, heroNames: blockedNames };
  }
  return { blocked: false, contexts };
}

/** Test helper — mirrors advisor pipeline mods/sheetOther for one hero. */
export function heroModsAndSheetOther(abilities: Record<string, number>): {
  mods: AbilityMods;
  sheetOther: ReturnType<typeof sheetOtherFromAbilities>;
} {
  const mods = abilityMods(abilities);
  return { mods, sheetOther: sheetOtherFromAbilities(abilities) };
}

export function gearedSheetFromContext(
  ctx: HeroPlanContext,
  loadout: import('../gear/types').Loadout,
  pts: import('../gear/types').PointAlloc,
): import('../gear/types').SheetStats {
  return composeSheetFromBirth({
    birth: ctx.birth,
    level: ctx.level,
    stars: ctx.stars,
    sheetOther: ctx.sheetOther,
    loadout,
    pts,
    tree: ctx.treeSheet,
  });
}

export function nakedSheetFromContext(ctx: HeroPlanContext): import('../gear/types').SheetStats {
  return nakedFromBirth(ctx.birth, ctx.level, ctx.stars, ctx.sheetOther);
}
