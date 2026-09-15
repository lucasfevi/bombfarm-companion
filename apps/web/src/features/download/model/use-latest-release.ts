'use client';

import { useEffect, useState } from 'react';
import {
  GITHUB_ACCEPT,
  fetchDownloadCounts,
  fetchLatestRelease,
  type DownloadCounts,
  type FetchJson,
  type LatestRelease,
} from './latest-release';

/**
 * `null` until it resolves, and `null` for good if the call fails — GitHub rate-limits
 * unauthenticated callers per IP, and a static export has no server to cache through. Everything
 * that reads this degrades to the releases page rather than to a wrong version or a zero count.
 */
function useGitHub<T>(load: (fetchJson: FetchJson) => Promise<T | null>): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchJson: FetchJson = (url) =>
      fetch(url, { signal: controller.signal, headers: { Accept: GITHUB_ACCEPT } });
    load(fetchJson)
      .then((loaded) => {
        if (loaded !== null && !controller.signal.aborted) setValue(loaded);
      })
      .catch(() => {
        /* offline, rate-limited, or blocked — the page falls back to the releases page */
      });
    return () => {
      controller.abort();
    };
  }, [load]);

  return value;
}

export function useLatestRelease(): LatestRelease | null {
  return useGitHub(fetchLatestRelease);
}

/** Walks every page of the release list, so it lands after `useLatestRelease` does. */
export function useDownloadCounts(): DownloadCounts | null {
  return useGitHub(fetchDownloadCounts);
}
