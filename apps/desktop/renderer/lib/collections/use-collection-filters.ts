'use client';

import { useCallback, useReducer } from 'react';
import type { CollectionAxis } from '@bombfarm/contracts';
import {
  acceptFilters,
  initialCollectionFilters,
  type CollectionBonusFilter,
  type CollectionFilters,
  type CollectionStatusFilter,
} from './collection-filters';

export interface CollectionFiltersHandle extends CollectionFilters {
  readonly setAxis: (axis: CollectionBonusFilter) => void;
  readonly toggleAxis: (axis: CollectionAxis) => void;
  readonly setStatus: (status: CollectionStatusFilter) => void;
  readonly setReadyOnly: (readyOnly: boolean) => void;
  readonly clear: () => void;
}

/** The Books panel's filters, held by the screen so the Bonuses panel can set one. Not kept past
 *  the screen: a filter left over from last visit would open the tab on a half-empty list. */
export function useCollectionFilters(): CollectionFiltersHandle {
  const [filters, dispatch] = useReducer(acceptFilters, initialCollectionFilters);
  const setAxis = useCallback((axis: CollectionBonusFilter) => {
    dispatch({ kind: 'axis', axis });
  }, []);
  const toggleAxis = useCallback((axis: CollectionAxis) => {
    dispatch({ kind: 'toggle-axis', axis });
  }, []);
  const setStatus = useCallback((status: CollectionStatusFilter) => {
    dispatch({ kind: 'status', status });
  }, []);
  const setReadyOnly = useCallback((readyOnly: boolean) => {
    dispatch({ kind: 'ready-only', readyOnly });
  }, []);
  const clear = useCallback(() => {
    dispatch({ kind: 'clear' });
  }, []);
  return { ...filters, setAxis, toggleAxis, setStatus, setReadyOnly, clear };
}
