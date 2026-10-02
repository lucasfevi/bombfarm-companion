/**
 * The Books panel's three filters and the rules that move them, as a pure reducer for the usual
 * reason: a static render runs no effects, so a rule inside a handler is a rule nothing can test.
 * The Bonuses panel sets the bonus filter from outside the toolbar, which is why the state lives
 * above both panels.
 */
import type { CollectionAxis } from '@bombfarm/contracts';
import type { CollectionSetStatus } from '@bombfarm/domain/model';

export type CollectionBonusFilter = CollectionAxis | 'all';
export type CollectionStatusFilter = CollectionSetStatus | 'all';

export interface CollectionFilters {
  readonly axis: CollectionBonusFilter;
  readonly status: CollectionStatusFilter;
  readonly readyOnly: boolean;
}

export type CollectionFiltersArrival =
  | { readonly kind: 'axis'; readonly axis: CollectionBonusFilter }
  | { readonly kind: 'toggle-axis'; readonly axis: CollectionAxis }
  | { readonly kind: 'status'; readonly status: CollectionStatusFilter }
  | { readonly kind: 'ready-only'; readonly readyOnly: boolean }
  | { readonly kind: 'clear' };

export const initialCollectionFilters: CollectionFilters = { axis: 'all', status: 'all', readyOnly: false };

/** The filters as they apply: the bag switch means nothing while the bag has not been read, so it
 *  neither narrows the list nor counts as an active filter. */
export function effectiveFilters(filters: CollectionFilters, bagAvailable: boolean): CollectionFilters {
  return filters.readyOnly && !bagAvailable ? { ...filters, readyOnly: false } : filters;
}

export function hasActiveFilters(filters: CollectionFilters): boolean {
  return filters.axis !== 'all' || filters.status !== 'all' || filters.readyOnly;
}

export function acceptFilters(state: CollectionFilters, arrival: CollectionFiltersArrival): CollectionFilters {
  switch (arrival.kind) {
    case 'axis':
      return state.axis === arrival.axis ? state : { ...state, axis: arrival.axis };
    case 'toggle-axis':
      return { ...state, axis: state.axis === arrival.axis ? 'all' : arrival.axis };
    case 'status':
      return state.status === arrival.status ? state : { ...state, status: arrival.status };
    case 'ready-only':
      return state.readyOnly === arrival.readyOnly ? state : { ...state, readyOnly: arrival.readyOnly };
    case 'clear':
      return hasActiveFilters(state) ? initialCollectionFilters : state;
  }
}
