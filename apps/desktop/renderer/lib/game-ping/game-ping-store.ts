/**
 * The latency readout's arrival rules, a pure reducer for the same reason the online-players
 * store's is: the renderer's Vitest run never runs `useEffect`. Main pushes `gamePing:changed`
 * only when the measurement moved, so every push is news; a read issued before a push and
 * answered after it is the stale one.
 */
import { emptyGamePingView, type GamePingView } from '@bombfarm/contracts';

export interface GamePingState {
  readonly applied: number;
  readonly view: GamePingView;
}

export type GamePingArrival =
  | { readonly kind: 'pushed'; readonly view: GamePingView }
  | { readonly kind: 'fetched'; readonly view: GamePingView; readonly issuedAt: number };

export const initialGamePingState: GamePingState = { applied: 0, view: emptyGamePingView };

export function accept(state: GamePingState, arrival: GamePingArrival): GamePingState {
  if (arrival.kind === 'fetched' && arrival.issuedAt !== state.applied) return state;
  return { applied: state.applied + 1, view: arrival.view };
}
