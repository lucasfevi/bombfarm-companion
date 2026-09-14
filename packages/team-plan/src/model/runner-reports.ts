import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanRunStatus } from '../core/run-status';

/** The slice of the runner's state the lifecycle reports are decided from. */
export type RunnerReportSource = {
  readonly runId: string | null;
  readonly status: TeamPlanRunStatus;
  readonly plan: TeamPlan | null;
};

/** Which run the screen has told the host about, and which finished run it has handed over. */
export type RunnerMarks = {
  readonly startedRunId: string | null;
  readonly handledRunId: string | null;
};

export type RunnerReport =
  | { readonly kind: 'startRun'; readonly runId: string }
  | { readonly kind: 'applyPlan'; readonly runId: string; readonly plan: TeamPlan }
  | { readonly kind: 'resolveRun'; readonly runId: string; readonly status: 'blocked' | 'error' };

/**
 * A screen mounting over a runner the host owns may find a run already there. One still in
 * flight was started from this screen's toolbar on an earlier mount, so the host already knows
 * it and only its finish is still owed. One already finished was handed to the host back then
 * too — reporting it again would make the host treat it as a new run, and, if the host has since
 * cleared that plan, bring the cleared plan back.
 */
export function runnerMarksAtMount(runner: RunnerReportSource): RunnerMarks {
  return {
    startedRunId: runner.runId,
    handledRunId: runner.status === 'running' ? null : runner.runId,
  };
}

/** The marks after the toolbar itself starts a run: the finish of whatever comes next is owed. */
export function runnerMarksBeforeRun(marks: RunnerMarks): RunnerMarks {
  return { ...marks, handledRunId: null };
}

/**
 * The reports owed to the host for the runner as it stands, and the marks once they are made.
 * `startRun` fires for a runId exactly once even when a synchronous main-thread run lets React
 * coalesce its 'running' and terminal states into the one render this is called from; a finish
 * is handed over once, and never for a run still running.
 */
export function runnerReports(
  runner: RunnerReportSource,
  marks: RunnerMarks,
): { readonly reports: readonly RunnerReport[]; readonly marks: RunnerMarks } {
  const runId = runner.runId;
  if (runId === null) return { reports: [], marks };

  const reports: RunnerReport[] = [];
  let next = marks;
  if (next.startedRunId !== runId) {
    next = { ...next, startedRunId: runId };
    reports.push({ kind: 'startRun', runId });
  }
  if (runner.status === 'running' || next.handledRunId === runId) return { reports, marks: next };

  next = { ...next, handledRunId: runId };
  if (runner.status === 'done' && runner.plan !== null) {
    reports.push({ kind: 'applyPlan', runId, plan: runner.plan });
  } else if (runner.status === 'blocked' || runner.status === 'error') {
    reports.push({ kind: 'resolveRun', runId, status: runner.status });
  }
  return { reports, marks: next };
}
