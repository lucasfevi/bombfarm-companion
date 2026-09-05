/**
 * The run as the screen sees it — a pure reducer over the events main pushes, and the two
 * derived views the rail draws from it. `idle → running → done → dismissed → idle`; a step for a
 * run this screen did not start (one injected by the smoke, or one begun before the screen
 * mounted) is adopted from the event itself rather than dropped.
 */
import type { ForgeDoneEvent, ForgeRunResult, ForgeStepEvent } from '@bombfarm/contracts';
import { emptyForgeTally, foldForgeStep, type ForgeTally } from '@bombfarm/domain/forge';
import type { ForgePlanForecast } from './use-forge-plan';

/** The figures the plan panel printed when the run started — never recomputed afterwards. */
export type ForgeRunPlan = {
  readonly forecast: ForgePlanForecast | null;
};

export type ForgeRunActive = {
  readonly runId: string;
  readonly itemId: string;
  readonly target: number;
  readonly from: number;
  readonly upgrade: number;
  readonly wallet: number | null;
  readonly tally: ForgeTally;
  readonly steps: readonly ForgeStepEvent[];
  readonly plan: ForgeRunPlan | null;
};

export type ForgeRunState =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly run: ForgeRunActive }
  | { readonly status: 'done'; readonly run: ForgeRunActive; readonly result: ForgeRunResult }
  | { readonly status: 'dismissed' };

/** The piece on screen and its plan, offered with every step so a run adopted from its own
 *  events carries the plan figures when it is that piece — decided here, in sequence, because
 *  the events of one run can all arrive in a single batch before the screen re-renders. */
export type ForgeRunAdoption = { readonly itemId: string; readonly plan: ForgeRunPlan };

export type ForgeRunAction =
  | { kind: 'start'; runId: string; itemId: string; target: number; from: number; plan: ForgeRunPlan | null }
  | { kind: 'step'; event: ForgeStepEvent; adopt: ForgeRunAdoption | null }
  | { kind: 'done'; event: ForgeDoneEvent }
  | { kind: 'dismiss' }
  | { kind: 'settle' };

export const IDLE_FORGE_RUN: ForgeRunState = { status: 'idle' };

function freshRun(input: { runId: string; itemId: string; target: number; from: number; plan: ForgeRunPlan | null }): ForgeRunActive {
  return {
    runId: input.runId,
    itemId: input.itemId,
    target: input.target,
    from: input.from,
    upgrade: input.from,
    wallet: null,
    tally: emptyForgeTally(),
    steps: [],
    plan: input.plan,
  };
}

/** A step's target is the rung it rolled for, so a run adopted from its own steps learns its
 *  target as the climb goes; a run this screen started already knows a higher one and keeps it. */
function fold(run: ForgeRunActive, event: ForgeStepEvent): ForgeRunActive {
  return {
    ...run,
    target: Math.max(run.target, event.target),
    upgrade: event.to,
    wallet: event.wallet,
    tally: foldForgeStep(run.tally, event),
    steps: [...run.steps, event],
  };
}

export function forgeRunReducer(state: ForgeRunState, action: ForgeRunAction): ForgeRunState {
  switch (action.kind) {
    case 'start':
      return { status: 'running', run: freshRun(action) };
    case 'step': {
      const { event, adopt } = action;
      if (state.status === 'running' && state.run.runId === event.runId) {
        return { status: 'running', run: fold(state.run, event) };
      }
      const plan = adopt !== null && adopt.itemId === event.itemId ? adopt.plan : null;
      const adopted = freshRun({ runId: event.runId, itemId: event.itemId, target: event.target, from: event.from, plan });
      return { status: 'running', run: fold(adopted, event) };
    }
    case 'done':
      if (state.status !== 'running' || state.run.runId !== action.event.runId) return state;
      return { status: 'done', run: state.run, result: action.event.result };
    case 'dismiss':
      return state.status === 'done' ? { status: 'dismissed' } : state;
    case 'settle':
      return state.status === 'dismissed' ? IDLE_FORGE_RUN : state;
  }
}

/** A finished run is the moment the pinned account read stops describing the piece — the view
 *  adopts the live read once, here, rather than waiting for the toolbar's refresh. */
export function shouldAdoptLiveAfter(previous: ForgeRunState['status'], next: ForgeRunState['status']): boolean {
  return previous === 'running' && next === 'done';
}

export type ForgeRungRow = {
  /** The first and last rung the row stands for; equal for a rung that stands alone. */
  readonly from: number;
  readonly to: number;
  readonly rolls: number;
  readonly fails: number;
  readonly gold: number;
};

/**
 * Rolls, fails and gold by the rung they were rolling for, lowest first, with consecutive
 * quiet rungs — no fail on any of them — merged into one row, so a climb that only stumbled at
 * the top reads as `+9…+11` and `+12` rather than four identical lines.
 */
export function rungTally(steps: readonly ForgeStepEvent[]): ForgeRungRow[] {
  const byRung = new Map<number, { rolls: number; fails: number; gold: number }>();
  for (const step of steps) {
    const row = byRung.get(step.target) ?? { rolls: 0, fails: 0, gold: 0 };
    row.rolls += step.kind === 'roll' ? 1 : 0;
    row.fails += step.outcome === 'fail' ? 1 : 0;
    row.gold += step.cost;
    byRung.set(step.target, row);
  }
  const rungs = [...byRung.keys()].sort((a, b) => a - b);

  const rows: ForgeRungRow[] = [];
  for (const rung of rungs) {
    const row = byRung.get(rung);
    if (!row) continue;
    const previous = rows[rows.length - 1];
    const quiet = row.fails === 0;
    if (previous && quiet && previous.fails === 0 && previous.to === rung - 1) {
      rows[rows.length - 1] = { ...previous, to: rung, rolls: previous.rolls + row.rolls, gold: previous.gold + row.gold };
    } else {
      rows.push({ from: rung, to: rung, ...row });
    }
  }
  return rows;
}

export const RECENT_MARKS = 12;

export function recentSteps(steps: readonly ForgeStepEvent[], count: number = RECENT_MARKS): readonly ForgeStepEvent[] {
  return steps.slice(Math.max(0, steps.length - count));
}
