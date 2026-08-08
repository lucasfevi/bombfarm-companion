import type { GearPlanInput } from '@bombfarm/domain/gear-plan/types';
import type { PlannerStore } from '@/shared/stores/planner-store';
import { resolveHeroScope } from '@/shared/stores/gear-plan/types';
import { selectTreeSheetTotals } from '@/shared/stores/selectors/tree-sheet-selectors';

export function buildGearPlanInputFromStore(state: PlannerStore): GearPlanInput {
  const treeSheet = selectTreeSheetTotals(state);

  const heroes = state.heroes.map((hero) => ({
    heroId: hero.sourceId ?? hero.id,
    name: hero.name,
    level: hero.level,
    stars: hero.stars,
    rarity: hero.rarity,
    birth: hero.birth,
    abilities: hero.abilities,
    pts: hero.pts,
    loadout: hero.loadout,
    battleAllowed: hero.battleAllowed,
  }));

  return {
    heroes,
    inventory: state.inventory.items,
    account: {
      treeSheet,
      treeGlassCannon: state.treeGlassCannon,
      treeTempoDobrado: state.treeTempoDobrado,
      treeAbisso: state.treeAbisso,
      houseIdx: state.houseIdx,
      houseLevel: state.houseLevel,
      phase: state.phase,
      mitigationPct: state.mitigationPct,
      slots: state.slots,
    },
    // Must match the scope board: missing keys use battleAllowed defaults (Donate when
    // disabled), never a hard-coded Optimize — that silently scored Donate-looking heroes.
    scopeByHeroId: Object.fromEntries(
      state.heroes.map((hero) => {
        const key = hero.sourceId ?? hero.id;
        return [key, resolveHeroScope(hero, state.scopeByHeroId)];
      }),
    ),
    forgeFloor: state.forgeFloor,
  };
}

export function countOptimizeScopeHeroes(state: PlannerStore): number {
  return state.heroes.filter((hero) => resolveHeroScope(hero, state.scopeByHeroId) === 'optimize')
    .length;
}

export function heroScopeKey(hero: { id: string; sourceId?: string }): string {
  return hero.sourceId ?? hero.id;
}

export function shortHeroRecordId(hero: { id: string; sourceId?: string }): string {
  const raw = hero.sourceId ?? hero.id;
  return raw.length > 5 ? raw.slice(-5) : raw;
}
