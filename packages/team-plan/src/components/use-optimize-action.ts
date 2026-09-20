'use client';

import { useCallback, useEffect, useRef } from 'react';
import { buildTeamPlanInput, countOptimizeScopeHeroes, isFarmObjectiveUnavailable } from '../core';
import { resolveTeamPlanTargetPhase } from '../core/plan-lifecycle';
import { runnerMarksAtMount, runnerMarksBeforeRun, runnerReports } from '../model/runner-reports';
import type { TeamPlanRunner } from '../runner';
import type { TeamPlanScreenActions, TeamPlanScreenData } from './team-plan-screen';

export type OptimizeAction = {
  readonly run: () => void;
  readonly busy: boolean;
  /** Nothing in scope, or a gold plan with no phase to score at: the press does nothing. */
  readonly blocked: boolean;
  readonly farmBlocked: boolean;
  readonly scopeEmpty: boolean;
};

/**
 * The one way a run starts, whichever button asks for it: the setup panel's, or the ledger's
 * "build again". Owns the runner's report marks, so a run's start, result and end reach the host
 * exactly once however many buttons share the runner.
 */
export function useOptimizeAction(data: TeamPlanScreenData, actions: TeamPlanScreenActions, runner: TeamPlanRunner): OptimizeAction {
  const resolvedTargetPhase = resolveTeamPlanTargetPhase(data.inputs, data.controls);
  const farmUnavailable = isFarmObjectiveUnavailable(data.inputs.maxPhase, resolvedTargetPhase);
  const farmBlocked = data.controls.objective === 'farm' && farmUnavailable;
  const scopeEmpty = countOptimizeScopeHeroes(data.inputs.heroes, data.controls.scopeByHeroId) === 0;
  // Seeded from the runner as it stands at mount, never from nothing: a host-owned runner
  // outlives this screen, and a run it already finished was handed over on the mount that
  // started it — see `runnerMarksAtMount`.
  const marksRef = useRef(runnerMarksAtMount(runner));

  const run = useCallback(() => {
    if (countOptimizeScopeHeroes(data.inputs.heroes, data.controls.scopeByHeroId) === 0) return;
    if (data.controls.objective === 'farm' && farmUnavailable) return;
    marksRef.current = runnerMarksBeforeRun(marksRef.current);
    runner.run(buildTeamPlanInput(data.inputs, data.controls));
  }, [runner, data.inputs, data.controls, farmUnavailable]);

  useEffect(() => {
    const { reports, marks } = runnerReports(runner, marksRef.current);
    marksRef.current = marks;
    for (const report of reports) {
      if (report.kind === 'startRun') actions.startRun(report.runId);
      else if (report.kind === 'applyPlan') actions.applyPlan(report.runId, report.plan);
      else actions.resolveRun(report.runId, report.status);
    }
  }, [runner, actions]);

  const busy = runner.status === 'running' || data.runStatus === 'running';
  return { run, busy, blocked: busy || scopeEmpty || farmBlocked, farmBlocked, scopeEmpty };
}
