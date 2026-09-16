/**
 * The duel history's arrival rules, isolated into a pure reducer for the same reason
 * `account-view-store.ts` is: this project's Vitest run is node-environment with
 * `renderToStaticMarkup`, which never runs `useEffect`, so a rule that lives inside the effect is
 * a rule nothing can test.
 *
 * Main pushes `pvp:changed` only when it kept a body it did not already hold, so every push is
 * news; the mount read is the same list, and loses to any push that overtook it.
 */
import type { PvpHistoryResult } from '@bombfarm/contracts';

export type PvpHistoryArrival =
  | { readonly kind: 'pushed'; readonly history: PvpHistoryResult }
  | { readonly kind: 'fetched'; readonly history: PvpHistoryResult; readonly issuedAt: number }
  | { readonly kind: 'fetch-failed'; readonly issuedAt: number }
  | { readonly kind: 'bridge-missing' };

export type PvpHistoryState =
  | { readonly status: 'loading'; readonly applied: number; readonly history: null }
  | { readonly status: 'bridge-unavailable'; readonly applied: number; readonly history: null }
  | { readonly status: 'unavailable'; readonly applied: number; readonly history: null }
  | { readonly status: 'ready'; readonly applied: number; readonly history: PvpHistoryResult };

export const initialPvpHistoryState: PvpHistoryState = { status: 'loading', applied: 0, history: null };

export function accept(state: PvpHistoryState, arrival: PvpHistoryArrival): PvpHistoryState {
  switch (arrival.kind) {
    case 'bridge-missing':
      return state.status === 'bridge-unavailable'
        ? state
        : { status: 'bridge-unavailable', applied: state.applied, history: null };

    case 'pushed':
      return { status: 'ready', applied: state.applied + 1, history: arrival.history };

    case 'fetched':
      if (arrival.issuedAt !== state.applied) return state;
      return { status: 'ready', applied: state.applied + 1, history: arrival.history };

    case 'fetch-failed':
      if (state.status === 'ready') return state;
      return { status: 'unavailable', applied: state.applied, history: null };
  }
}
