/**
 * The Points tab's on-demand farm search — the farm counterpart to `optimizeBuild`, which the
 * panel calls directly.
 *
 * A PLAIN FUNCTION: not a selector, not memoized, and never called during render. Its only
 * caller is the Optimize build click handler, on an explicit user event. A full farm solve is a
 * squad-wide phase sweep per candidate; putting it anywhere on the dependency-driven render
 * path is the hazard `farm-ranking-selectors.ts`'s two-tier split exists to prevent, and this
 * module inherits that rule rather than relaxing it.
 */
import { optimizeHeroForFarm, type HeroFarmOptimizeResult } from '@bombfarm/domain/farm-hero-optimize';
import type { PlannerStore } from '@/shared/stores/planner-store';
import { buildAccount } from '@/shared/stores/selectors/farm-ranking-selectors';
import { selectActiveHeroFarmBases } from '@/shared/stores/selectors/next-point-selectors';

let solveCount = 0;

export function getHeroFarmOptimizeSolveCount(): number {
  return solveCount;
}

export function resetHeroFarmOptimizeSolveCount(): void {
  solveCount = 0;
}

export function runHeroFarmOptimize(state: PlannerStore): HeroFarmOptimizeResult {
  solveCount += 1;
  const account = buildAccount(state);
  const composed = selectActiveHeroFarmBases(state);

  if (composed.kind === 'unavailable') {
    // Both unavailable outcomes read the same to a player — there is no rotation to score this
    // hero against — so the domain's own empty-pool terminal is the honest answer rather than a
    // result shape hand-built out here, where it would drift from the domain's.
    return optimizeHeroForFarm({ bases: [], account, heroId: state.activeHeroId ?? '' });
  }

  return optimizeHeroForFarm({
    bases: composed.bases,
    account,
    heroId: composed.heroId,
    maxPhase: state.maxPhase,
    returnBonus: state.farmReturnBonus,
  });
}
