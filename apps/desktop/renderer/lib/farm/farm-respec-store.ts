/**
 * The respec advisor's state, as a pure reducer beside the board's — same shape and same reason
 * as `farm-snapshot-store.ts`: a rule that lives inside an effect is a rule nothing here can
 * test.
 *
 * Four values, all ephemeral and none persisted: the proposal, whether a solve is running, and
 * the two view flags. The advisor is read-only advice ("move these points, gain this much"); it
 * writes no build and stores nothing across a run.
 *
 * A proposal is keyed by the dependency tuple it was solved against, and {@link freshProposal} is
 * the ONLY way to read one. That makes a stale proposal unrenderable by construction rather than
 * by an effect that has to remember to clear it — the same mechanism the web planner uses, driven
 * by the same two exported functions.
 */
import { farmDepsEqual, readFarmRespecDepTuple, type FarmInputs } from '@bombfarm/farm/core';
import type { FarmRespecProposal, FarmRespecStatus } from '@bombfarm/farm';

export type FarmRespecState = {
  readonly proposal: FarmRespecProposal | null;
  readonly status: FarmRespecStatus;
  readonly panelOpen: boolean;
  readonly reRank: boolean;
};

export type FarmRespecArrival =
  /** The player pressed Optimize and a solve is starting. */
  | { readonly kind: 'solving' }
  | { readonly kind: 'solved'; readonly proposal: FarmRespecProposal }
  | { readonly kind: 'failed' }
  | { readonly kind: 'panel'; readonly open: boolean }
  | { readonly kind: 'rerank'; readonly active: boolean };

export const initialFarmRespecState: FarmRespecState = {
  proposal: null,
  status: 'idle',
  panelOpen: false,
  reRank: false,
};

/** Pure, and returns the SAME reference for an arrival that changes nothing. */
export function acceptRespec(
  state: FarmRespecState,
  arrival: FarmRespecArrival,
): FarmRespecState {
  switch (arrival.kind) {
    case 'solving':
      if (state.status === 'solving') return state;
      return { ...state, status: 'solving', panelOpen: true };

    case 'solved':
      return { ...state, proposal: arrival.proposal, status: 'done' };

    case 'failed':
      return { ...state, proposal: null, status: 'failed' };

    case 'panel':
      if (state.panelOpen === arrival.open) return state;
      return { ...state, panelOpen: arrival.open };

    // Turning re-rank on closes the panel — that mode is for looking at the table — and turning
    // it back off re-opens it. Neither re-solves: an unchanged proposal is simply reused.
    case 'rerank':
      if (state.reRank === arrival.active) return state;
      return { ...state, reRank: arrival.active, panelOpen: !arrival.active };
  }
}

/**
 * The proposal ONLY when the inputs it was solved against are still the inputs on screen. A
 * recompute rebuilds `FarmInputs`, so the tuple moves and this returns `null` — no effect, no
 * subscription and no write-on-render is involved in dropping it.
 */
export function freshProposal(
  state: FarmRespecState,
  inputs: FarmInputs | null,
): FarmRespecProposal | null {
  if (state.proposal === null || inputs === null) return null;
  return farmDepsEqual(state.proposal.deps, readFarmRespecDepTuple(inputs))
    ? state.proposal
    : null;
}

/** `reRank` is only ever true over a fresh proposal, so the table can never be captioned as
 *  showing a hypothetical build that no longer exists. */
export function reRankActive(state: FarmRespecState, inputs: FarmInputs | null): boolean {
  return state.reRank && freshProposal(state, inputs) !== null;
}
