'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarketSnapshot } from '@bombfarm/pricing';
import {
  loadMarketSnapshot,
  refreshMarketSnapshot,
  type MarketSnapshotErrorKind,
} from '@/shared/lib/market-snapshot';

export type MarketSnapshotStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface UseMarketSnapshotResult {
  snapshot: MarketSnapshot | null;
  status: MarketSnapshotStatus;
  generatedUtc: string | null;
  refresh: () => void;
  isRefreshing: boolean;
  error: MarketSnapshotErrorKind | null;
}

export function resolveMarketStatus(
  settled: boolean,
  snapshot: MarketSnapshot | null,
  error: MarketSnapshotErrorKind | null,
): MarketSnapshotStatus {
  if (!settled) return 'loading';
  if (snapshot == null) return error == null ? 'empty' : 'error';
  return snapshot.entries.length === 0 ? 'empty' : 'ready';
}

export function useMarketSnapshot(): UseMarketSnapshotResult {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState<MarketSnapshotErrorKind | null>(null);
  const [settled, setSettled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mounted = useRef(true);

  // Loading here rather than during render: the route prerenders to static HTML, where neither
  // `localStorage` nor `fetch` of a browser-cached response is available.
  useEffect(() => {
    mounted.current = true;
    void loadMarketSnapshot().then((result) => {
      if (!mounted.current) return;
      if (result.snapshot != null) setSnapshot(result.snapshot);
      setError(result.error);
      setSettled(true);
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    void refreshMarketSnapshot().then((result) => {
      if (!mounted.current) return;
      if (result.snapshot != null) setSnapshot(result.snapshot);
      setError(result.error);
      setSettled(true);
      setIsRefreshing(false);
    });
  }, []);

  return {
    snapshot,
    status: resolveMarketStatus(settled, snapshot, error),
    generatedUtc: snapshot?.generatedUtc ?? null,
    refresh,
    isRefreshing,
    error,
  };
}
