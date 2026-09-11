/**
 * The optimizer's plan lifecycle, as a pure reducer beside the snapshot's — same shape and same
 * reason as `optimizer-snapshot-store.ts`: a rule that lives inside an effect is a rule nothing
 * here can test.
 *
 * The package's own screen presses Optimize and runs the search itself; this module never calls
 * a runner. It only folds the four lifecycle reports the screen's toolbar effect makes —
 * `startRun`, `resolveRun`, `applyPlan`, `clearPlan` — into one state, so there is exactly one
 * place a plan is ever applied (D-19). `startRun` records the signature the screen built its run
 * from, not the live signature at the moment the plan lands: a Refresh that changes the snapshot
 * mid-run must not silently re-key a plan solved from the account behind it (D-16).
 */
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanRunStatus } from '@bombfarm/team-plan/core';

export type OptimizerPlanState = {
  readonly runStatus: TeamPlanRunStatus;
  readonly runId: string | null;
  readonly plan: TeamPlan | null;
  /** The signature the run in flight was built from (D-16); becomes the applied plan's key. */
  readonly signature: string | null;
};

export type OptimizerPlanArrival =
  | { readonly kind: 'startRun'; readonly runId: string; readonly signature: string }
  | { readonly kind: 'resolveRun'; readonly runId: string; readonly status: Exclude<TeamPlanRunStatus, 'running'> }
  | { readonly kind: 'applyPlan'; readonly runId: string; readonly plan: TeamPlan }
  | { readonly kind: 'clearPlan' };

export const initialOptimizerPlanState: OptimizerPlanState = {
  runStatus: 'idle',
  runId: null,
  plan: null,
  signature: null,
};

/**
 * Pure, and returns the SAME state reference for an arrival that changes nothing.
 *
 * - `startRun` — a no-op for the run already in flight; otherwise starts a new one, dropping
 *   whatever plan the previous run left (a new Optimize supersedes).
 * - `resolveRun` — ignored unless it names the run currently in flight; a superseded run's late
 *   report changes nothing.
 * - `applyPlan` — ignored unless it names the run currently in flight, so a run finished after
 *   Cancel or after a control change cleared the plan cannot land; a no-op when the exact same
 *   plan reference is already applied (a remount re-reporting a finished run).
 * - `clearPlan` — a no-op once the state is already idle with nothing recorded.
 */
export function acceptPlan(state: OptimizerPlanState, arrival: OptimizerPlanArrival): OptimizerPlanState {
  switch (arrival.kind) {
    case 'startRun':
      if (state.runId === arrival.runId && state.runStatus === 'running') return state;
      return { runStatus: 'running', runId: arrival.runId, plan: null, signature: arrival.signature };

    case 'resolveRun':
      if (state.runId !== arrival.runId) return state;
      if (state.runStatus === arrival.status) return state;
      return { ...state, runStatus: arrival.status };

    case 'applyPlan':
      if (state.runId !== arrival.runId) return state;
      if (state.plan === arrival.plan) return state;
      return { ...state, plan: arrival.plan, runStatus: 'done' };

    case 'clearPlan':
      if (
        state.runStatus === 'idle' &&
        state.runId === null &&
        state.plan === null &&
        state.signature === null
      ) {
        return state;
      }
      return initialOptimizerPlanState;
  }
}
