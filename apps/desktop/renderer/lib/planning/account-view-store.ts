/**
 * The only asynchrony in MP3 F3, isolated into a pure reducer (design.md §4.4, `AD-047`) so it
 * is testable at all: `apps/desktop`'s Vitest project is node-environment with
 * `renderToStaticMarkup`, which never runs `useEffect` — see `use-account-view.ts`'s own comment
 * (kept from F2). No React import — assert it by reading the source, F2's own technique
 * (`use-account-view.test.ts`).
 */
import { accountChangeKey } from '@bombfarm/contracts';
import type { AccountView } from '@bombfarm/contracts';

export type Arrival =
  | { readonly kind: 'pushed'; readonly view: AccountView }
  | { readonly kind: 'fetched'; readonly view: AccountView; readonly issuedAt: number }
  | { readonly kind: 'fetch-failed'; readonly message: string; readonly issuedAt: number }
  | { readonly kind: 'bridge-missing' };

export type AccountViewState =
  | { readonly status: 'loading'; readonly applied: number; readonly key: null }
  | { readonly status: 'bridge-unavailable'; readonly applied: number; readonly key: null }
  | { readonly status: 'error'; readonly message: string; readonly applied: number; readonly key: string | null }
  | { readonly status: 'loaded'; readonly view: AccountView; readonly applied: number; readonly key: string };

export const initialAccountViewState: AccountViewState = { status: 'loading', applied: 0, key: null };

/**
 * Pure. `state.applied` is bumped on every ACCEPTED view (design §4.4); `state.key` is the last
 * accepted view's tier-0 `accountChangeKey`. Four rules, in order:
 *
 * 1. `bridge-missing` ⇒ `bridge-unavailable`. Never throws (F2's behaviour, preserved).
 * 2. `pushed` ⇒ accepted iff `accountChangeKey(view.payload) !== state.key` (MAR-03's accept
 *    gate). Main is single-threaded, so anything it pushes is, by construction, the newest thing
 *    it knows — never conditioned on `issuedAt`.
 * 3. `fetched` ⇒ **discarded** when `issuedAt !== state.applied` — i.e. a push landed while this
 *    `account:get` was in flight. Main materialises the `get`'s value at handler time, so any
 *    later emit is strictly later in main's own timeline: discarding is correct regardless of
 *    which the renderer observes first (MAR-11, and the spec's "first `account:changed` arrives
 *    before the initial `account:get` resolves" edge case — one rule covers both).
 * 4. `fetch-failed` ⇒ surfaces an error **only** if nothing has been applied yet. A failed read
 *    never blanks a good screen already on it.
 *
 * A no-op arrival (rule 2/3's key comparison finds no change) returns the SAME state reference —
 * not a shallow-equal copy — so a caller driving this through `setState(prev => accept(prev, arrival))`
 * gets React's own bail-out-on-Object.is behaviour for free: no re-render, not just a referentially
 * stable `HeroAdvice` further downstream.
 */
export function accept(state: AccountViewState, arrival: Arrival): AccountViewState {
  switch (arrival.kind) {
    case 'bridge-missing':
      return state.status === 'bridge-unavailable' ? state : { status: 'bridge-unavailable', applied: state.applied, key: null };

    case 'pushed': {
      const key = accountChangeKey(arrival.view.payload);
      if (key === state.key) return state;
      return { status: 'loaded', view: arrival.view, applied: state.applied + 1, key };
    }

    case 'fetched': {
      if (arrival.issuedAt !== state.applied) return state;
      const key = accountChangeKey(arrival.view.payload);
      if (key === state.key) return state;
      return { status: 'loaded', view: arrival.view, applied: state.applied + 1, key };
    }

    case 'fetch-failed': {
      if (state.status === 'loaded') return state;
      return { status: 'error', message: arrival.message, applied: state.applied, key: state.key };
    }
  }
}
