/**
 * The online-players count's arrival rules, a pure reducer for the same reason the market store's
 * is: the renderer's Vitest run never runs `useEffect`, so a rule inside the effect cannot be
 * tested. Main pushes `onlinePlayers:changed` only when the count or its visibility moved, so
 * every push is news; a read issued before a push and answered after it is the stale one.
 */
import { emptyOnlinePlayersView, type OnlinePlayersView } from '@bombfarm/contracts';

export interface OnlinePlayersState {
  readonly applied: number;
  readonly view: OnlinePlayersView;
}

export type OnlinePlayersArrival =
  | { readonly kind: 'pushed'; readonly view: OnlinePlayersView }
  | { readonly kind: 'fetched'; readonly view: OnlinePlayersView; readonly issuedAt: number };

export const initialOnlinePlayersState: OnlinePlayersState = { applied: 0, view: emptyOnlinePlayersView };

export function accept(state: OnlinePlayersState, arrival: OnlinePlayersArrival): OnlinePlayersState {
  if (arrival.kind === 'fetched' && arrival.issuedAt !== state.applied) return state;
  return { applied: state.applied + 1, view: arrival.view };
}
