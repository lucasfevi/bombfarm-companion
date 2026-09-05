/**
 * The Forge screen's own state, held outside React. The shell unmounts a tab when the player
 * leaves it, so component state would throw the filter, the order, the piece in hand and the plan
 * made for it away on every visit to another screen; module scope survives that.
 *
 * Two things the state cannot promise on its own, and {@link resolveForgeScreen} settles on every
 * read: the stored piece may no longer be in the bag — a different account, or a piece forged past
 * the filter — and the stored target may no longer be a rung the piece can reach.
 */
import { useSyncExternalStore } from 'react';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { DEFAULT_FORGE_SORT, EMPTY_FORGE_FILTER, type ForgeFilter, type ForgeSort } from './forge-rows';
import { INITIAL_FORGE_PLAN, forgePlanFor, type ForgePlan } from './use-forge-plan';

export type ForgeScreenState = {
  readonly filter: ForgeFilter;
  readonly sort: ForgeSort;
  readonly selectedId: string | null;
  readonly plan: ForgePlan;
};

export const INITIAL_FORGE_SCREEN: ForgeScreenState = {
  filter: EMPTY_FORGE_FILTER,
  sort: DEFAULT_FORGE_SORT,
  selectedId: null,
  plan: INITIAL_FORGE_PLAN,
};

export type ForgeScreenReading = {
  readonly selected: InventoryViewItem | null;
  readonly plan: ForgePlan;
};

export function resolveForgeScreen(state: ForgeScreenState, gear: readonly InventoryViewItem[]): ForgeScreenReading {
  const selected = state.selectedId === null ? null : (gear.find((item) => item.id === state.selectedId) ?? null);
  return { selected, plan: forgePlanFor(state.plan, selected) };
}

/** Every member is a standalone function rather than a method: the screen hands these straight to
 *  a child as a callback, and a method carries a `this` that would not survive the trip. */
export interface ForgeScreenStore {
  readonly getState: () => ForgeScreenState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly setFilter: (filter: ForgeFilter) => void;
  readonly setSort: (sort: ForgeSort) => void;
  readonly select: (itemId: string | null) => void;
  readonly setPlan: (plan: ForgePlan) => void;
  readonly reset: () => void;
}

export function createForgeScreenStore(): ForgeScreenStore {
  let state = INITIAL_FORGE_SCREEN;
  const listeners = new Set<() => void>();

  function put(next: ForgeScreenState): void {
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
      put({ ...state, sort });
    },
    select: (itemId) => {
      if (itemId === state.selectedId) return;
      put({ ...state, selectedId: itemId });
    },
    setPlan: (plan) => {
      put({ ...state, plan });
    },
    reset: () => {
      put(INITIAL_FORGE_SCREEN);
    },
  };
}

/** The one the screen reads. Its members are re-exported as standalone functions rather than
 *  handed out as `store.setSort` — a screen passes each of these straight to a child as a
 *  callback, and a bare function has nothing to lose on the way. */
const screen = createForgeScreenStore();

const subscribe = (listener: () => void) => screen.subscribe(listener);
const snapshot = () => screen.getState();

export function useForgeScreen(): ForgeScreenState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function setForgeFilter(filter: ForgeFilter): void {
  screen.setFilter(filter);
}

export function setForgeSort(sort: ForgeSort): void {
  screen.setSort(sort);
}

export function selectForgePiece(itemId: string | null): void {
  screen.select(itemId);
}

export function setForgePlan(plan: ForgePlan): void {
  screen.setPlan(plan);
}
