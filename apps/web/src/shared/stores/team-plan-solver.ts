import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanRunnerHandle, TeamPlanRunStatus } from '@bombfarm/team-plan/runner';

export type TeamPlanSolverSnapshot = {
  status: TeamPlanRunStatus;
  plan: TeamPlan | null;
  blockedHeroNames: readonly string[];
  errorMessage: string | null;
  ranOnMainThread: boolean;
  runId: string | null;
};

export type TeamPlanSolver = {
  getSnapshot: () => TeamPlanSolverSnapshot;
  subscribe: (listener: () => void) => () => void;
  solve: () => void;
  cancel: () => void;
  runner: TeamPlanRunnerHandle;
};

let installed: TeamPlanSolver | null = null;

export function ensureTeamPlanSolver(create: () => TeamPlanSolver): TeamPlanSolver {
  if (installed === null) installed = create();
  return installed;
}

export function getTeamPlanSolver(): TeamPlanSolver {
  if (installed === null) {
    throw new Error(
      'No team-plan solver is installed — ClientMountGate installs one before the app renders.',
    );
  }
  return installed;
}

export function resetTeamPlanSolverForTests(): void {
  installed = null;
}
