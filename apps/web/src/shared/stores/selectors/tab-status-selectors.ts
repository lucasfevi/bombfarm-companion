import { SLOTS, defaultNaked } from '@bombfarm/domain/gear';
import { abilityPointBudget } from '@bombfarm/domain/model';
import {
  computePlannerTabStatuses,
  type PlannerTabStatuses,
} from '@bombfarm/domain/planner-tab-status';
import { sheetsClose } from '@bombfarm/domain/sheet-display';
import type { PlannerStore } from '@/shared/stores/planner-store';
import { selectStrings } from '@/shared/stores/selectors/session-selectors';
import { selectAdvisorPipeline } from '@/shared/stores/selectors/advisor-selectors';

let cache: { deps: readonly unknown[]; result: PlannerTabStatuses } | null = null;

export function resetPlannerTabStatusCache(): void {
  cache = null;
}

function depsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

function readTabStatusDepTuple(state: PlannerStore): readonly unknown[] {
  const pipeline = selectAdvisorPipeline(state);
  return [
    state.loadout,
    state.gearedOverride,
    state.naked,
    state.rarity,
    state.level,
    state.stars,
    state.abilities,
    state.targetProp,
    state.heroBattleAllowed,
    pipeline.spentDelta,
    pipeline.sheetOther,
    pipeline.resetAdvice.recommend,
    selectStrings(state),
  ];
}

export function selectPlannerTabStatuses(state: PlannerStore): PlannerTabStatuses {
  const deps = readTabStatusDepTuple(state);
  if (cache && depsEqual(cache.deps, deps)) {
    return cache.result;
  }
  const pipeline = selectAdvisorPipeline(state);
  const { spentDelta } = pipeline;
  const hasGear = SLOTS.some((slot) => state.loadout[slot] != null);
  const usingDefaultSheet = sheetsClose(
    state.gearedOverride,
    defaultNaked(state.rarity, state.level, pipeline.sheetOther, state.stars),
  );
  const abilityPointsSpent = Object.values(state.abilities).reduce((sum, points) => sum + (points || 0), 0);
  const abilityPointsMax = abilityPointBudget(state.rarity, state.level);
  const ptsLeft = Math.max(0, state.level - spentDelta);
  const abilityPtsLeft = Math.max(0, abilityPointsMax - abilityPointsSpent);
  const resetAdviceRecommend = pipeline.resetAdvice.recommend && state.heroBattleAllowed;

  const result = computePlannerTabStatuses({
    hasGear,
    usingDefaultSheet,
    ptsLeft,
    level: state.level,
    abilityPtsLeft,
    abilityPointsMax,
    targetProp: state.targetProp,
    resetAdviceRecommend,
    t: selectStrings(state),
  });
  cache = { deps, result };
  return result;
}

export const selectSetupReady = (state: PlannerStore) => selectPlannerTabStatuses(state).setupReady;
export const selectHeroTabStatus = (state: PlannerStore) => selectPlannerTabStatuses(state).heroTabStatus;
export const selectGearTabStatus = (state: PlannerStore) => selectPlannerTabStatuses(state).gearTabStatus;
export const selectAccountTabStatus = (state: PlannerStore) =>
  selectPlannerTabStatuses(state).accountTabStatus;
export const selectPointsTabStatus = (state: PlannerStore) =>
  selectPlannerTabStatuses(state).pointsTabStatus;
