/**
 * The duel list's opponent and result filters, held for the window's lifetime rather than the
 * panel's: the Rivals panel sets the opponent from outside the list, and a filter chosen before
 * a tab switch is still in place on return.
 */
import { useEffect, useState } from 'react';
import { createLazySingleton, createSharedStore, type SharedStore } from '../shared-store';
import { ALL_OPPONENTS, type PvpResultFilter } from './pvp-rows';

export interface PvpFilters {
  readonly opponent: string;
  readonly result: PvpResultFilter;
}

export type PvpFiltersArrival = { readonly kind: 'opponent'; readonly opponent: string } | { readonly kind: 'result'; readonly result: PvpResultFilter };

export const initialPvpFilters: PvpFilters = { opponent: ALL_OPPONENTS, result: 'all' };

export function accept(state: PvpFilters, arrival: PvpFiltersArrival): PvpFilters {
  switch (arrival.kind) {
    case 'opponent':
      return state.opponent === arrival.opponent ? state : { ...state, opponent: arrival.opponent };
    case 'result':
      return state.result === arrival.result ? state : { ...state, result: arrival.result };
  }
}

export interface PvpFiltersStore {
  readonly store: SharedStore<PvpFilters>;
  readonly setOpponent: (opponent: string) => void;
  readonly setResult: (result: PvpResultFilter) => void;
}

export function createPvpFiltersStore(): PvpFiltersStore {
  let dispatch: (arrival: PvpFiltersArrival) => void = () => undefined;
  const store = createSharedStore<PvpFilters, PvpFiltersArrival>({
    initial: initialPvpFilters,
    accept,
    connect: (dispatchInto) => {
      dispatch = dispatchInto;
    },
  });
  store.start();
  return {
    store,
    setOpponent: (opponent) => {
      dispatch({ kind: 'opponent', opponent });
    },
    setResult: (result) => {
      dispatch({ kind: 'result', result });
    },
  };
}

const sharedPvpFiltersStore = createLazySingleton(createPvpFiltersStore);

export interface PvpFiltersHandle extends PvpFilters {
  readonly setOpponent: (opponent: string) => void;
  readonly setResult: (result: PvpResultFilter) => void;
}

export function usePvpFilters(): PvpFiltersHandle {
  const [state, setState] = useState<PvpFilters>(() => sharedPvpFiltersStore().store.getState());

  useEffect(() => {
    const { store } = sharedPvpFiltersStore();
    const unsubscribe = store.subscribe(setState);
    setState(store.getState());
    return unsubscribe;
  }, []);

  const { setOpponent, setResult } = sharedPvpFiltersStore();
  return { ...state, setOpponent, setResult };
}
