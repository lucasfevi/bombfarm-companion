/** Held outside React because the shell unmounts a tab the player leaves. */
import { useSyncExternalStore } from 'react';
import type { InventorySort, InventorySortDirection } from '@bombfarm/domain/inventory-view';
import { EMPTY_DECONSTRUCT_FILTER, type DeconstructFilter } from './deconstruct-rows';
import { withoutDeconstructIds } from './deconstruct-selection';

/** The game's own order: the highest level first, the rarest first among equals. */
export const DEFAULT_DECONSTRUCT_SORT: InventorySort = [
  { key: 'level', direction: 'desc' },
  { key: 'rarity', direction: 'desc' },
];

export type DeconstructScreenState = {
  readonly filter: DeconstructFilter;
  readonly sort: InventorySort;
  /** The direction the Essence column orders the list by, laid over {@link sort}; `null` when the
   *  list is in `sort` order alone. Held here, not in the table, so "Add all" ticks the rows
   *  in the order the player sees. */
  readonly essenceSort: InventorySortDirection | null;
  /** Item ids in the order they were ticked. */
  readonly selectedIds: readonly string[];
  /** The game account the ticks were made on; `null` until a read names one. */
  readonly accountKey: string | null;
};

export const INITIAL_DECONSTRUCT_SCREEN: DeconstructScreenState = {
  filter: EMPTY_DECONSTRUCT_FILTER,
  sort: DEFAULT_DECONSTRUCT_SORT,
  essenceSort: null,
  selectedIds: [],
  accountKey: null,
};

/** Every member is a standalone function rather than a method: the screen hands these straight to
 *  a child as a callback, and a method carries a `this` that would not survive the trip. */
export interface DeconstructScreenStore {
  readonly getState: () => DeconstructScreenState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly setFilter: (filter: DeconstructFilter) => void;
  readonly setSort: (sort: InventorySort) => void;
  readonly setEssenceSort: (direction: InventorySortDirection | null) => void;
  readonly setSelection: (ids: readonly string[]) => void;
  readonly unselect: (ids: readonly string[]) => void;
  /** Records the account a read belongs to and empties the batch when it is a different one from
   *  the last; returns whether it did. A read that names no account changes nothing. */
  readonly adoptAccount: (accountKey: string | null) => boolean;
  readonly reset: () => void;
}

export function createDeconstructScreenStore(): DeconstructScreenStore {
  let state = INITIAL_DECONSTRUCT_SCREEN;
  const listeners = new Set<() => void>();

  function put(next: DeconstructScreenState): void {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setFilter: (filter) => {
      put({ ...state, filter });
    },
    setSort: (sort) => {
      put({ ...state, sort, essenceSort: null });
    },
    setEssenceSort: (essenceSort) => {
      if (essenceSort === state.essenceSort) return;
      put({ ...state, essenceSort });
    },
    setSelection: (selectedIds) => {
      if (selectedIds === state.selectedIds) return;
      put({ ...state, selectedIds });
    },
    unselect: (ids) => {
      const selectedIds = withoutDeconstructIds(state.selectedIds, ids);
      if (selectedIds === state.selectedIds) return;
      put({ ...state, selectedIds });
    },
    adoptAccount: (accountKey) => {
      if (accountKey === null || accountKey === state.accountKey) return false;
      const switched = state.accountKey !== null;
      put({ ...state, accountKey, selectedIds: switched && state.selectedIds.length > 0 ? [] : state.selectedIds });
      return switched;
    },
    reset: () => {
      put(INITIAL_DECONSTRUCT_SCREEN);
    },
  };
}

const screen = createDeconstructScreenStore();

const subscribe = (listener: () => void) => screen.subscribe(listener);
const snapshot = () => screen.getState();

export function useDeconstructScreen(): DeconstructScreenState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function setDeconstructFilter(filter: DeconstructFilter): void {
  screen.setFilter(filter);
}

export function setDeconstructSort(sort: InventorySort): void {
  screen.setSort(sort);
}

export function setDeconstructEssenceSort(direction: InventorySortDirection | null): void {
  screen.setEssenceSort(direction);
}

export function setDeconstructSelection(ids: readonly string[]): void {
  screen.setSelection(ids);
}

export function unselectDeconstruct(ids: readonly string[]): void {
  screen.unselect(ids);
}

export function adoptDeconstructAccount(accountKey: string | null): boolean {
  return screen.adoptAccount(accountKey);
}

export function deconstructSelection(): readonly string[] {
  return screen.getState().selectedIds;
}
