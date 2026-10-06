/**
 * The Collections state's arrival rules, isolated into a pure reducer for the same reason the duel
 * history's are: this project's Vitest run is node-environment with `renderToStaticMarkup`, which
 * never runs `useEffect`, so a rule that lives inside the effect is a rule nothing can test.
 *
 * Main pushes `collections:changed` every time a read lands, even one that repeats what it held
 * (the date moves), so every push is news; the mount read is the same view, and loses to any push
 * that overtook it.
 */
import type { CollectionsView } from '@bombfarm/contracts';
import { EMPTY_COLLECTIONS_VIEW } from '@bombfarm/contracts';

export type CollectionsArrival =
  | { readonly kind: 'pushed'; readonly view: CollectionsView }
  | { readonly kind: 'fetched'; readonly view: CollectionsView; readonly issuedAt: number }
  | { readonly kind: 'fetch-failed'; readonly issuedAt: number }
  | { readonly kind: 'bridge-missing' };

export type CollectionsState =
  | { readonly status: 'loading'; readonly applied: number; readonly view: CollectionsView }
  | { readonly status: 'bridge-unavailable'; readonly applied: number; readonly view: CollectionsView }
  | { readonly status: 'unavailable'; readonly applied: number; readonly view: CollectionsView }
  | { readonly status: 'ready'; readonly applied: number; readonly view: CollectionsView };

export const initialCollectionsState: CollectionsState = {
  status: 'loading',
  applied: 0,
  view: EMPTY_COLLECTIONS_VIEW,
};

export function accept(state: CollectionsState, arrival: CollectionsArrival): CollectionsState {
  switch (arrival.kind) {
    case 'bridge-missing':
      return state.status === 'bridge-unavailable'
        ? state
        : { status: 'bridge-unavailable', applied: state.applied, view: EMPTY_COLLECTIONS_VIEW };

    case 'pushed':
      return { status: 'ready', applied: state.applied + 1, view: arrival.view };

    case 'fetched':
      if (arrival.issuedAt !== state.applied) return state;
      return { status: 'ready', applied: state.applied + 1, view: arrival.view };

    case 'fetch-failed':
      if (state.status === 'ready') return state;
      return { status: 'unavailable', applied: state.applied, view: EMPTY_COLLECTIONS_VIEW };
  }
}
