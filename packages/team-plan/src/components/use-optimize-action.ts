'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  buildTeamPlanInput,
  countOptimizeScopeHeroes,
  isFarmObjectiveUnavailable,
  isPvpObjectiveUnavailable,
} from '../core';
import { resolveTeamPlanTargetPhase } from '../core/plan-lifecycle';
import { runnerMarksAtMount, runnerMarksBeforeRun, runnerReports } from '../model/runner-reports';
import type { TeamPlanRunner } from '../runner';
import type { TeamPlanScreenActions, TeamPlanScreenData } from './team-plan-screen';

export type OptimizeAction = {
  readonly run: () => void;
  readonly busy: boolean;
  /** Nothing in scope, a gold plan with no phase to score at, or a duel with no squad: the press
   *  does nothing. */
  readonly blocked: boolean;
  readonly farmBlocked: boolean;
  readonly pvpBlocked: boolean;
  readonly scopeEmpty: boolean;
};

/**
 * Whether the objective as set can be scored at all — the one rule the button, the press and the
 * notice all read, so none of the three can disagree.
 */
export function objectiveUnavailable(data: Pick<TeamPlanScreenData, 'inputs' | 'controls'>): {
  farmBlocked: boolean;
  pvpBlocked: boolean;
} {
  const resolvedTargetPhase = resolveTeamPlanTargetPhase(data.inputs, data.controls);
  return {
    farmBlocked: data.controls.objective === 'farm' && isFarmObjectiveUnavailable(data.inputs.maxPhase, resolvedTargetPhase),
    pvpBlocked: data.controls.objective === 'pvp' && isPvpObjectiveUnavailable(data.inputs, data.controls),
  };
}

/**
 * The one way a run starts, whichever button asks for it: the setup panel's, or the ledger's
 * "build again". Owns the runner's report marks, so a run's start, result and end reach the host
 * exactly once however many buttons share the runner.
 */
export function useOptimizeAction(data: TeamPlanScreenData, actions: TeamPlanScreenActions, runner: TeamPlanRunner): OptimizeAction {
  const { farmBlocked, pvpBlocked } = objectiveUnavailable(data);
  const scopeEmpty = countOptimizeScopeHeroes(data.inputs.heroes, data.controls.scopeByHeroId) === 0;
  // Seeded from the runner as it stands at mount, never from nothing: a host-owned runner
  // outlives this screen, and a run it already finished was handed over on the mount that
  // started it — see `runnerMarksAtMount`.
  const marksRef = useRef(runnerMarksAtMount(runner));

  const { inputs, controls } = data;
  const run = useCallback(() => {
    if (countOptimizeScopeHeroes(inputs.heroes, controls.scopeByHeroId) === 0) return;
    const unavailable = objectiveUnavailable({ inputs, controls });
    if (unavailable.farmBlocked || unavailable.pvpBlocked) return;
    marksRef.current = runnerMarksBeforeRun(marksRef.current);
    runner.run(buildTeamPlanInput(inputs, controls));
  }, [runner, inputs, controls]);

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
  return { run, busy, blocked: busy || scopeEmpty || farmBlocked || pvpBlocked, farmBlocked, pvpBlocked, scopeEmpty };
}
