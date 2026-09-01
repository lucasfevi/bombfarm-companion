/**
 * The farm board's snapshot state, as a pure reducer — the shape `account-view-store.ts`
 * established, and for the same reason: this project's Vitest run is node-environment with
 * `renderToStaticMarkup`, which never runs `useEffect`, so a rule that lives inside an effect is
 * a rule nothing can test.
 *
 * The account payload behind this screen refreshes from the live game every few seconds. The
 * board is computed from the account as it stood when the player opened the screen and must NOT
 * follow those ticks: a table that re-ranks itself underneath someone mid-read is the behaviour
 * being designed out. Three things recompute it — opening the screen against an account that has
 * moved since the snapshot, an explicit refresh, and a change to one of the two compute inputs.
 * Filtering, sorting and picking a phase are post-compute and reach nothing here.
 *
 * That property is structural rather than a comparison someone has to keep correct. This module
 * holds no `AccountView` and imports none: an account reaches it only as a `sourceKey` string,
 * carried by `begin` or `refresh`, both user-initiated. There is no arrival a live tick could
 * dispatch, so no live tick can move this state — asserted in the test by reading this source.
 */
import type { FarmInputs, FarmRankingResult, FarmRespecGate } from '@bombfarm/farm/core';
import type { FarmControls } from './farm-inputs';

/**
 * One compute's settled products: the board, the inputs it was computed from, the first-tier
 * respec gate over those same inputs, and the moment the compute finished. The gate is cheap and
 * rides along with the compute rather than being re-derived while the screen paints — the
 * expensive second tier is a button press, and lives nowhere near here.
 */
export type FarmSettledBoard = {
  readonly board: FarmRankingResult;
  readonly inputs: FarmInputs;
  readonly gate: FarmRespecGate;
  /** ISO-8601, stamped by whoever ran the compute — this module reads no clock of its own. */
  readonly computedAt: string;
};

/**
 * An account was read, but not one the board may be computed from — a section whose fidelity
 * forbids trusting it, a whole-file rejection, or a required value the desktop refuses to
 * default. "No account yet" is not a reason here: until one is read there is no snapshot at all,
 * and the state stays `idle` while the account seam reports its own loading or bridge failure.
 */
export type FarmSnapshotUnavailableReason = 'incomplete-account';

export type FarmSnapshotState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'computing';
      readonly controls: FarmControls;
      readonly sourceKey: string;
      /**
       * The board still on screen while this compute runs, or `null` on the very first one. A
       * recompute is not a reason to blank the screen: unmounting the board for a frame throws
       * away the filters and the column sort it holds, so a rotation-pool toggle used to reset
       * both. The board stays mounted and is marked busy instead.
       */
      readonly previous: FarmSettledBoard | null;
    }
  | ({
      readonly status: 'ready';
      readonly controls: FarmControls;
      readonly sourceKey: string;
    } & FarmSettledBoard)
  | {
      readonly status: 'unavailable';
      readonly reason: FarmSnapshotUnavailableReason;
      readonly sourceKey: string;
    };

export type FarmComputeOutcome =
  | ({ readonly ok: true } & FarmSettledBoard)
  | { readonly ok: false; readonly reason: FarmSnapshotUnavailableReason };

/**
 * Exactly four arrivals may change this state, and two of them carry a `sourceKey` — the
 * `accountChangeKey` of the `AccountView` a snapshot was taken from. Both are user-initiated.
 */
export type FarmSnapshotArrival =
  /** The screen opened. */
  | { readonly kind: 'begin'; readonly sourceKey: string; readonly controls: FarmControls }
  /** The player asked for the live account to be adopted. */
  | { readonly kind: 'refresh'; readonly sourceKey: string; readonly controls: FarmControls }
  /** A compute input changed — recompute against the same frozen view. */
  | { readonly kind: 'controls'; readonly controls: FarmControls }
  /** A compute finished. */
  | {
      readonly kind: 'computed';
      readonly sourceKey: string;
      readonly controls: FarmControls;
      readonly outcome: FarmComputeOutcome;
    };

export const initialFarmSnapshotState: FarmSnapshotState = { status: 'idle' };

/** The snapshot the state was taken from, or `null` when there is no snapshot yet. */
export function snapshotSourceKey(state: FarmSnapshotState): string | null {
  return state.status === 'idle' ? null : state.sourceKey;
}

/**
 * The board the screen should be drawing, settled or merely being recomputed — `null` only when
 * there has never been one. A screen reads this and `status === 'computing'` separately: the
 * first says what to draw, the second says whether to mark it busy.
 */
export function settledBoard(state: FarmSnapshotState): FarmSettledBoard | null {
  if (state.status === 'ready') {
    return {
      board: state.board,
      inputs: state.inputs,
      gate: state.gate,
      computedAt: state.computedAt,
    };
  }
  if (state.status === 'computing') return state.previous;
  return null;
}

/**
 * Pure, and returns the SAME state reference for an arrival that changes nothing, so a caller
 * driving this through `setState` gets React's bail-out-on-`Object.is` for free. Four rules:
 *
 * 1. `begin` ⇒ recomputes only when nothing is held for THIS account. Re-opening the screen on
 *    the snapshot already in hand is a no-op; opening it after the account moved takes the new
 *    one, which is the "changed since the last snapshot" case.
 * 2. `refresh` ⇒ adopts the view it was handed. Nothing to do only when a board for that exact
 *    account and those exact controls is already on screen.
 * 3. `controls` ⇒ recomputes against the frozen `sourceKey`, never a newer one. Ignored from
 *    `idle` (no frozen view) and from `unavailable` (the gate that produced that reason reads no
 *    control, so a recompute lands on the same reason).
 * 4. `computed` ⇒ **discarded** unless the state is still waiting for exactly this compute — the
 *    same latest-wins rule the account seam's own reducer follows. Controls are compared by
 *    reference because the dispatcher hands the very object it computed with to both arrivals.
 */
export function accept(state: FarmSnapshotState, arrival: FarmSnapshotArrival): FarmSnapshotState {
  switch (arrival.kind) {
    case 'begin':
      if (snapshotSourceKey(state) === arrival.sourceKey) return state;
      return {
        status: 'computing',
        controls: arrival.controls,
        sourceKey: arrival.sourceKey,
        previous: settledBoard(state),
      };

    case 'refresh':
      if (
        state.status === 'ready' &&
        state.sourceKey === arrival.sourceKey &&
        state.controls === arrival.controls
      ) {
        return state;
      }
      return {
        status: 'computing',
        controls: arrival.controls,
        sourceKey: arrival.sourceKey,
        previous: settledBoard(state),
      };

    case 'controls':
      if (state.status !== 'ready' && state.status !== 'computing') return state;
      if (state.controls === arrival.controls) return state;
      return {
        status: 'computing',
        controls: arrival.controls,
        sourceKey: state.sourceKey,
        previous: settledBoard(state),
      };

    case 'computed': {
      if (state.status !== 'computing') return state;
      if (state.sourceKey !== arrival.sourceKey || state.controls !== arrival.controls) return state;
      if (!arrival.outcome.ok) {
        return { status: 'unavailable', reason: arrival.outcome.reason, sourceKey: arrival.sourceKey };
      }
      return {
        status: 'ready',
        board: arrival.outcome.board,
        inputs: arrival.outcome.inputs,
        gate: arrival.outcome.gate,
        computedAt: arrival.outcome.computedAt,
        controls: arrival.controls,
        sourceKey: arrival.sourceKey,
      };
    }
  }
}
