import { describe, expect, it } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { runnerMarksAtMount, runnerMarksBeforeRun, runnerReports, type RunnerMarks } from './runner-reports';

const PLAN = { planDps: 1 } as unknown as TeamPlan;
const FRESH: RunnerMarks = { startedRunId: null, handledRunId: null };

describe('a screen mounting over a host-owned runner', () => {
  it('never re-reports a run that finished before this mount: the host already has it, or has cleared it', () => {
    const runner = { runId: 'r1', status: 'done', plan: PLAN } as const;
    const { reports } = runnerReports(runner, runnerMarksAtMount(runner));
    expect(reports).toEqual([]);
  });

  it('still hands over the finish of a run that was in flight at mount', () => {
    const running = { runId: 'r1', status: 'running', plan: null } as const;
    const marks = runnerMarksAtMount(running);
    expect(runnerReports(running, marks).reports).toEqual([]);
    const finished = { runId: 'r1', status: 'done', plan: PLAN } as const;
    expect(runnerReports(finished, marks).reports).toEqual([{ kind: 'applyPlan', runId: 'r1', plan: PLAN }]);
  });

  it('a runner with no run yet leaves nothing to report', () => {
    const idle = { runId: null, status: 'idle', plan: null } as const;
    expect(runnerReports(idle, runnerMarksAtMount(idle)).reports).toEqual([]);
  });
});

describe('a run this screen starts', () => {
  it('reports startRun once, then the finish once', () => {
    const marks = runnerMarksBeforeRun(FRESH);
    const running = { runId: 'r1', status: 'running', plan: null } as const;
    const first = runnerReports(running, marks);
    expect(first.reports).toEqual([{ kind: 'startRun', runId: 'r1' }]);
    expect(runnerReports(running, first.marks).reports).toEqual([]);

    const done = { runId: 'r1', status: 'done', plan: PLAN } as const;
    const second = runnerReports(done, first.marks);
    expect(second.reports).toEqual([{ kind: 'applyPlan', runId: 'r1', plan: PLAN }]);
    expect(runnerReports(done, second.marks).reports).toEqual([]);
  });

  it('a synchronous main-thread run that skipped the running render still reports its start before its plan', () => {
    const done = { runId: 'r1', status: 'done', plan: PLAN } as const;
    expect(runnerReports(done, runnerMarksBeforeRun(FRESH)).reports).toEqual([
      { kind: 'startRun', runId: 'r1' },
      { kind: 'applyPlan', runId: 'r1', plan: PLAN },
    ]);
  });

  it('a blocked or errored run resolves with its status, once', () => {
    const blocked = { runId: 'r1', status: 'blocked', plan: null } as const;
    const first = runnerReports(blocked, FRESH);
    expect(first.reports).toEqual([
      { kind: 'startRun', runId: 'r1' },
      { kind: 'resolveRun', runId: 'r1', status: 'blocked' },
    ]);
    expect(runnerReports(blocked, first.marks).reports).toEqual([]);
    const errored = { runId: 'r2', status: 'error', plan: null } as const;
    expect(runnerReports(errored, first.marks).reports).toEqual([
      { kind: 'startRun', runId: 'r2' },
      { kind: 'resolveRun', runId: 'r2', status: 'error' },
    ]);
  });

  it('a second Optimize after a finished run owes that run its own start and finish', () => {
    const done = { runId: 'r1', status: 'done', plan: PLAN } as const;
    const settled = runnerReports(done, FRESH).marks;
    const marks = runnerMarksBeforeRun(settled);
    const next = { runId: 'r2', status: 'done', plan: PLAN } as const;
    expect(runnerReports(next, marks).reports).toEqual([
      { kind: 'startRun', runId: 'r2' },
      { kind: 'applyPlan', runId: 'r2', plan: PLAN },
    ]);
  });
});
