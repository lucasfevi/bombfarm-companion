import type { TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import type { PlannerStore } from '@/shared/stores/planner-store';

/**
 * Reads the planner store's skill-tree fields into a `TreeSheetTotals` for
 * birth-recomposition call sites (`sheetsFromBirth`, `buildTeamPlanInputFromStore`).
 * Shared by `use-hero-build-actions` and `use-hero-draft-actions` — kept out of
 * `shared/domain` because it reads store state directly (see docs/architecture.md
 * layering rule: `shared/domain` must not import `shared/stores`).
 */
export function selectTreeSheetTotals(state: PlannerStore): TreeSheetTotals {
  return {
    danoStatic: state.treeDanoTotal,
    energyPct: state.treeEnergy,
    speedPct: state.treeSpeed,
    critChancePct: state.treeCritChance,
    critDmgPct: state.treeCritDmg,
    luckFlatPct: state.treeLuckFlatPct,
  };
}
