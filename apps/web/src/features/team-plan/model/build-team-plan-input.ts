import type { TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import type { PlannerStore } from '@/shared/stores/planner-store';
import { resolveHeroScope } from '@/shared/stores/team-plan/types';
import { selectTreeSheetTotals } from '@/shared/stores/selectors/tree-sheet-selectors';
import { selectTeamPlanTargetPhase } from '@/shared/stores/selectors/team-plan-selectors';

export function buildTeamPlanInputFromStore(state: PlannerStore): TeamPlanInput {
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
      houseIdx: state.houseIdx,
      houseLevel: state.houseLevel,
      phase: state.phase,
      mitigationPct: state.mitigationPct,
      slots: state.slots,
      // FIELD concurrency cap, not the House recovery number above — `state.slots` is a
      // pre-`skills.field_slots` fallback only (same convention as `SquadFarmFacts`
      // in `farm-rate.ts`), not a synonym for it.
      fieldSlots: state.fieldSlots ?? state.slots,
      // The scorer's duty cycle divides by this — the save's own House cycle when it carried
      // one, else the `HOUSES` table. Same value the advisor and the farm board use.
      cycleSecs: state.houseCycleSecs,
      // The (house, level) `cycleSecs` above is anchored to — see `AccountSlice.houseCycleSecsHouseIdx`.
      cycleSecsHouseIdx: state.houseCycleSecsHouseIdx,
      cycleSecsLevel: state.houseCycleSecsLevel,
      // Read by the farm objective only, and it refuses to plan without `maxPhase` — supplied
      // here so a caller switching a plan to gold cannot silently get the 600-phase ceiling.
      teamCoinPct: state.treeTeamCoinPct,
      xpMult: state.treeXpMult,
      maxPhase: state.maxPhase,
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
    objective: state.objective,
    // Both objectives score here. Null is the objective's own default: gold sweeps for its best
    // phase, damage stays on the account's own.
    targetPhase: selectTeamPlanTargetPhase(state),
  };
}

export function countOptimizeScopeHeroes(state: PlannerStore): number {
  return state.heroes.filter((hero) => resolveHeroScope(hero, state.scopeByHeroId) === 'optimize')
    .length;
}

export function heroScopeKey(hero: { id: string; sourceId?: string }): string {
  return hero.sourceId ?? hero.id;
}
