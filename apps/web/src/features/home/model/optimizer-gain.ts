import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { FARM_RESPEC_WORTH_MAKING_PCT } from '@bombfarm/farm/core';

export function gainPct(plan: TeamPlan): number {
  return plan.currentDps > 0 ? ((plan.planDps - plan.currentDps) / plan.currentDps) * 100 : 0;
}

export function belowFloor(plan: TeamPlan): boolean {
  return gainPct(plan) < FARM_RESPEC_WORTH_MAKING_PCT;
}
