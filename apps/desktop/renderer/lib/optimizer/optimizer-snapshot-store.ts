/**
 * The Optimizer tab's snapshot state, as a pure reducer — the same shape as
 * `../farm/farm-snapshot-store.ts`, for the same reason: this project's Vitest run is
 * node-environment with `renderToStaticMarkup`, which never runs `useEffect`, so a rule that
 * lives inside an effect is a rule nothing can test.
 *
 * The account payload behind this screen refreshes from the live game every few seconds. The
 * snapshot is computed from the account as it stood when the player opened the tab and must NOT
 * follow those ticks. Only `begin` and `refresh` may replace it — both user-initiated, and both
 * carrying the Farm phase the caller wants written into the inputs (D-17): a Farm phase change
 * alone re-takes the snapshot on the next open, exactly like an account change.
 *
 * That property is structural rather than a comparison someone has to keep correct. This module
 * holds no `AccountView` and imports none: an account reaches it only as a `sourceKey` string,
 * and a Farm phase reaches it only as a plain number, both carried by `begin` or `refresh`. There
 * is no arrival a live tick could dispatch, so no live tick can move this state — asserted in the
 * test by reading this source.
 */
import type { TeamPlanInputs } from '@bombfarm/team-plan/core';

/**
 * One compute's settled products: the inputs it was built from, and the age of the account they
 * came from.
 */
export type OptimizerSettledSnapshot = {
  readonly inputs: TeamPlanInputs;
  /**
   * ISO-8601 capture time of the ACCOUNT these inputs were built from — the oldest across its
   * five sections — not the moment the compute ran. `oldestCaptureOf`, never `Date.now()`: a
   * recompute over an account the app has stopped being able to re-read is a fresh calculation
   * over old data, and stamping the compute made the screen call that "just now". `null` when
   * the account carries no readable capture time at all.
   */
  readonly capturedAt: string | null;
};

/**
 * An account was read, but not one the inputs may be built from — a section whose fidelity
 * forbids trusting it, a whole-file rejection, or a required value the desktop refuses to
 * default (A-5). "No account yet" is not a reason here: until one is read there is no snapshot at
 * all, and the state stays `idle` while the account seam reports its own loading or bridge
 * failure.
 */
export type OptimizerSnapshotUnavailableReason = 'incomplete-account';

export type OptimizerSnapshotState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'computing';
      readonly sourceKey: string;
      readonly farmChosenPhase: number | null;
      /** The snapshot still on screen while this compute runs, or `null` on the very first one.
       *  A recompute is not a reason to blank the screen — see `farm-snapshot-store.ts`'s own
       *  `previous` for why. */
      readonly previous: OptimizerSettledSnapshot | null;
    }
  | ({
      readonly status: 'ready';
      readonly sourceKey: string;
      readonly farmChosenPhase: number | null;
    } & OptimizerSettledSnapshot)
  | {
      readonly status: 'unavailable';
      readonly reason: OptimizerSnapshotUnavailableReason;
      readonly sourceKey: string;
      readonly farmChosenPhase: number | null;
    };

export type OptimizerComputeOutcome =
  | ({ readonly ok: true } & OptimizerSettledSnapshot)
  | { readonly ok: false; readonly reason: OptimizerSnapshotUnavailableReason };

/**
 * Four arrivals; two carry a `sourceKey` — the `accountChangeKey` of the `AccountView` a snapshot
 * was taken from — and the Farm phase the mapper should be given (D-17). Both are user-initiated.
 */
export type OptimizerSnapshotArrival =
  /** The tab opened. */
  | { readonly kind: 'begin'; readonly sourceKey: string; readonly farmChosenPhase: number | null }
  /** The player asked for the live account to be adopted. */
  | { readonly kind: 'refresh'; readonly sourceKey: string; readonly farmChosenPhase: number | null }
  /**
   * A pinned no-op, present only so all four arrivals match the Farm store's vocabulary and its
   * test: the optimizer's controls are not inputs of the snapshot — they meet the account only
   * inside the screen's Optimize press — so a control change must never re-take it.
   */
  | { readonly kind: 'controls' }
  /** A compute finished. */
  | {
      readonly kind: 'computed';
      readonly sourceKey: string;
      readonly farmChosenPhase: number | null;
      readonly outcome: OptimizerComputeOutcome;
    };

export const initialOptimizerSnapshotState: OptimizerSnapshotState = { status: 'idle' };

/** The snapshot's own source key, or `null` when there is no snapshot yet. */
export function snapshotSourceKey(state: OptimizerSnapshotState): string | null {
  return state.status === 'idle' ? null : state.sourceKey;
}

/**
 * The inputs the screen should be drawing, settled or merely being recomputed — `null` only when
 * there has never been one.
 */
export function settledSnapshot(state: OptimizerSnapshotState): OptimizerSettledSnapshot | null {
  if (state.status === 'ready') {
    return { inputs: state.inputs, capturedAt: state.capturedAt };
  }
  if (state.status === 'computing') return state.previous;
  return null;
}

/**
 * Pure, and returns the SAME state reference for an arrival that changes nothing.
 *
 * 1. `begin` ⇒ recomputes only when nothing is held for THIS account and Farm phase. Re-opening
 *    the tab on the snapshot already in hand, unchanged, is a no-op; either the account or the
 *    Farm phase moving takes a new one.
 * 2. `refresh` ⇒ adopts the view it was handed. Nothing to do only when a snapshot for that exact
 *    account and Farm phase is already on screen.
 * 3. `controls` ⇒ always a no-op — pinned by the test.
 * 4. `computed` ⇒ **discarded** unless the state is still waiting for exactly this compute — the
 *    same latest-wins rule the account seam's own reducer follows.
 */
export function acceptOptimizer(
  state: OptimizerSnapshotState,
  arrival: OptimizerSnapshotArrival,
): OptimizerSnapshotState {
  switch (arrival.kind) {
    case 'begin':
      if (
        state.status !== 'idle' &&
        state.sourceKey === arrival.sourceKey &&
        state.farmChosenPhase === arrival.farmChosenPhase
      ) {
        return state;
      }
      return {
        status: 'computing',
        sourceKey: arrival.sourceKey,
        farmChosenPhase: arrival.farmChosenPhase,
        previous: settledSnapshot(state),
      };

    case 'refresh':
      if (
        state.status === 'ready' &&
        state.sourceKey === arrival.sourceKey &&
        state.farmChosenPhase === arrival.farmChosenPhase
      ) {
        return state;
      }
      return {
        status: 'computing',
        sourceKey: arrival.sourceKey,
        farmChosenPhase: arrival.farmChosenPhase,
        previous: settledSnapshot(state),
      };

    case 'controls':
      return state;

    case 'computed': {
      if (state.status !== 'computing') return state;
      if (state.sourceKey !== arrival.sourceKey || state.farmChosenPhase !== arrival.farmChosenPhase) {
        return state;
      }
      if (!arrival.outcome.ok) {
        return {
          status: 'unavailable',
          reason: arrival.outcome.reason,
          sourceKey: arrival.sourceKey,
          farmChosenPhase: arrival.farmChosenPhase,
        };
      }
      return {
        status: 'ready',
        sourceKey: arrival.sourceKey,
        farmChosenPhase: arrival.farmChosenPhase,
        inputs: arrival.outcome.inputs,
        capturedAt: arrival.outcome.capturedAt,
      };
    }
  }
}
