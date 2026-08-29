/**
 * The market snapshot's arrival rules, isolated into a pure reducer for the same reason
 * `account-view-store.ts` is: this project's Vitest run is node-environment with
 * `renderToStaticMarkup`, which never runs `useEffect`, so a rule that lives inside the effect is
 * a rule nothing can test.
 *
 * Main pushes `market:changed` only when it has adopted a different snapshot or merged a fresh
 * quote, so there is no accept gate here to mirror the account store's — every push is, by
 * construction, news.
 */
import type { MarketQuoteTarget, MarketSnapshotView } from '@bombfarm/contracts';
import type { MarketSnapshot } from '@bombfarm/pricing';

export type MarketView = MarketSnapshotView<MarketSnapshot>;

export type MarketArrival =
  | { readonly kind: 'pushed'; readonly view: MarketView }
  | { readonly kind: 'fetched'; readonly view: MarketView; readonly issuedAt: number }
  | { readonly kind: 'fetch-failed'; readonly issuedAt: number }
  | { readonly kind: 'bridge-missing' };

export type MarketState =
  | { readonly status: 'loading'; readonly applied: number; readonly view: null }
  | { readonly status: 'bridge-unavailable'; readonly applied: number; readonly view: null }
  | { readonly status: 'unavailable'; readonly applied: number; readonly view: null }
  | { readonly status: 'ready'; readonly applied: number; readonly view: MarketView };

export const initialMarketState: MarketState = { status: 'loading', applied: 0, view: null };

/**
 * Three rules, in order:
 *
 * 1. `bridge-missing` ⇒ `bridge-unavailable`, and never throws.
 * 2. `fetched` ⇒ discarded when `issuedAt !== state.applied`, i.e. a push landed while the mount
 *    read was in flight. Main materialises the read at handler time, so anything it pushed after
 *    that is strictly newer whichever the renderer observes first.
 * 3. `fetch-failed` ⇒ surfaces only when nothing has been applied yet. A failed read never blanks
 *    prices already on screen — which is the whole point of the disk cache behind it.
 */
export function accept(state: MarketState, arrival: MarketArrival): MarketState {
  switch (arrival.kind) {
    case 'bridge-missing':
      return state.status === 'bridge-unavailable'
        ? state
        : { status: 'bridge-unavailable', applied: state.applied, view: null };

    case 'pushed':
      return { status: 'ready', applied: state.applied + 1, view: arrival.view };

    case 'fetched':
      if (arrival.issuedAt !== state.applied) return state;
      return { status: 'ready', applied: state.applied + 1, view: arrival.view };

    case 'fetch-failed':
      if (state.status === 'ready') return state;
      return { status: 'unavailable', applied: state.applied, view: null };
  }
}

/** A stable identity for one refresh target, so two requests for the same item coalesce. */
export function quoteTargetId(target: MarketQuoteTarget): string {
  return target.kind === 'key' ? `key:${target.key}` : `hash:${target.hashName}`;
}
