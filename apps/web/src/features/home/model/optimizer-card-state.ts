import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanRunStatus } from '@bombfarm/team-plan/core';
import type { HomeCardState } from '@/features/home/model/home-card-state';

export type OptimizerCardStateInput = {
  inputsUsable: boolean;
  runStatus: TeamPlanRunStatus;
  plan: TeamPlan | null;
  stale: boolean;
  belowFloor: boolean;
};

export function optimizerCardState(input: OptimizerCardStateInput): HomeCardState {
  if (!input.inputsUsable) return 'needs';
  if (input.runStatus === 'blocked') return 'blocked';
  if (input.runStatus === 'error') return 'error';
  if (input.plan == null) return 'optimizing';
  if (input.stale) return 'recalculating';
  return input.belowFloor ? 'belowFloor' : 'plan';
}
