import { runTeamPlan } from '@bombfarm/domain/team-plan';
import type { TeamPlanFarmFixture } from './team-plan-farm-fixtures';

export function farmPlan(fixture: TeamPlanFarmFixture, maxEvaluations?: number) {
  const result = runTeamPlan({ ...fixture.teamPlanInput, objective: 'farm' }, maxEvaluations ? { maxEvaluations } : undefined);
  if (result.blocked) throw new Error('expected a plan');
  return result.plan;
}
