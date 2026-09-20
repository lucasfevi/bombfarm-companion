/**
 * The modal's ledger, folded from the run's `ApplyEvent` stream — a pure reducer over the same
 * events the smoke's `apply:inject` replays. The store (`apply-store.ts`) is the only dispatcher;
 * this file knows nothing of the bridge, the queue, or React.
 */
import type { ApplyEvent, ApplyRunResult, ApplySkipReason, ApplyStep } from '@bombfarm/contracts';
import type { ApplyUnitLabel } from './apply-labels';

export type UnitStatus = 'next' | 'sent' | 'ok' | 'skipped' | 'failed';

/** One unit the `done` event's skip list or the row's "Show" names — the modal's skip reasons are
 *  the contracts' `ApplySkipReason` (all eight, including `alreadyDone`). */
export type SkipRecord = { readonly index: number; readonly reason: ApplySkipReason; readonly code?: string };

export type ApplyRunView = {
  readonly runId: string;
  readonly units: readonly ApplyUnitLabel[];
  readonly status: readonly UnitStatus[];
  readonly current: number | null;
  readonly skipped: readonly SkipRecord[];
  readonly goldSpent: number;
  readonly walletAfter: number | null;
  readonly startedAtMs: number;
  readonly cooldown: { readonly index: number; readonly resumeAtMs: number } | null;
  readonly result: ApplyRunResult | null;
};

/** The view a run starts at — every unit `next`, nothing spent yet. `step` is accepted (and
 *  threaded by every caller) for symmetry with the events this view folds, even though the view
 *  itself carries no field for it — `apply-progress-reducer.ts` keys the run by step already. */
export function beginRun(step: ApplyStep, runId: string, units: readonly ApplyUnitLabel[], startedAtMs: number): ApplyRunView {
  return {
    runId,
    units,
    status: units.map(() => 'next'),
    current: null,
    skipped: [],
    goldSpent: 0,
    walletAfter: null,
    startedAtMs,
    cooldown: null,
    result: null,
  };
}

function withStatus(status: readonly UnitStatus[], index: number, next: UnitStatus): readonly UnitStatus[] {
  if (status[index] === next) return status;
  return status.map((value, i) => (i === index ? next : value));
}

export function applyRunReducer(run: ApplyRunView, event: ApplyEvent): ApplyRunView {
  if (event.runId !== run.runId) return run;

  switch (event.type) {
    case 'unit': {
      if (event.index < 0 || event.index >= run.units.length) return run;
      const goldSpent = event.goldSpent ?? run.goldSpent;
      const walletAfter = event.walletAfter !== undefined ? event.walletAfter : run.walletAfter;
      switch (event.status) {
        case 'sent':
          return { ...run, status: withStatus(run.status, event.index, 'sent'), current: event.index, goldSpent, walletAfter };
        case 'ok':
          return { ...run, status: withStatus(run.status, event.index, 'ok'), goldSpent, walletAfter };
        case 'skipped':
          return {
            ...run,
            status: withStatus(run.status, event.index, 'skipped'),
            skipped:
              event.reason === undefined
                ? run.skipped
                : [...run.skipped, { index: event.index, reason: event.reason, ...(event.code === undefined ? {} : { code: event.code }) }],
            goldSpent,
            walletAfter,
          };
        case 'failed':
          return { ...run, status: withStatus(run.status, event.index, 'failed'), goldSpent, walletAfter };
      }
      break;
    }
    case 'cooldown': {
      if (event.index < 0 || event.index >= run.units.length) return run;
      return { ...run, cooldown: { index: event.index, resumeAtMs: event.resumeAtMs } };
    }
    case 'resumed': {
      if (event.index < 0 || event.index >= run.units.length) return run;
      return run.cooldown === null ? run : { ...run, cooldown: null };
    }
    case 'done':
      return { ...run, result: event.result, goldSpent: event.result.goldSpent, cooldown: null };
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

export function runCounts(run: ApplyRunView): { readonly done: number; readonly skipped: number; readonly left: number; readonly total: number; readonly current: number | null } {
  const done = run.status.filter((status) => status === 'ok').length;
  const skipped = run.status.filter((status) => status === 'skipped').length;
  const total = run.units.length;
  return { done, skipped, left: total - done - skipped, total, current: run.current };
}
