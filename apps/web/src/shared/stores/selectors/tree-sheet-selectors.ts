import type { TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import type { PlannerStore } from '@/shared/stores/planner-store';

/**
 * Reads the planner store's skill-tree fields into a `TreeSheetTotals` for
 * birth-recomposition call sites (`sheetsFromBirth`, `buildTeamPlanInputFromStore`).
 * Shared by `use-hero-build-actions` and `use-hero-draft-actions` — kept out of
 * `shared/domain` because it reads store state directly (see docs/architecture.md
 * layering rule: `shared/domain` must not import `shared/stores`).
 *
 * `critDmgMult` / `glassCannon` / `tempoDobrado` are the three keystone corrections
 * (see `birth-sheet.ts`'s `TreeSheetTotals` doc) — all three must be carried through here
 * too, exactly like `treeTotalsFromSave` (`save-units.ts`) does for the import path. A
 * previous version of this selector hardcoded `critDmgMult: 1` and omitted the two booleans
 * entirely, so every hero sheet recomposed from store state (including Team Plan scoring
 * via `buildTeamPlanInputFromStore`) silently ran keystone-free.
 */
export function selectTreeSheetTotals(state: PlannerStore): TreeSheetTotals {
  return {
    danoStatic: state.treeDanoTotal,
    energyPct: state.treeEnergy,
    speedPct: state.treeSpeed,
    critChancePct: state.treeCritChance,
    critDmgPct: state.treeCritDmg,
    luckFlatPct: state.treeLuckFlatPct,
    critDmgMult: state.treeCritDmgMult,
    glassCannon: state.treeGlassCannon,
    tempoDobrado: state.treeTempoDobrado,
  };
}
