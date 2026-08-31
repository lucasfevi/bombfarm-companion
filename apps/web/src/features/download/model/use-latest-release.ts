'use client';

import { useEffect, useState } from 'react';
import { RELEASES_API, parseLatestRelease, type LatestRelease } from './latest-release';

/**
 * `null` until it resolves, and `null` for good if the call fails — GitHub rate-limits
 * unauthenticated callers per IP, and a static export has no server to cache through. Everything
 * that reads this degrades to the releases page rather than to a wrong version or a zero count.
 */
export function useLatestRelease(): LatestRelease | null {
  const [release, setRelease] = useState<LatestRelease | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(RELEASES_API, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        const parsed = parseLatestRelease(payload);
        if (parsed !== null) setRelease(parsed);
      })
      .catch(() => {
        /* offline, rate-limited, or blocked — the page falls back to the releases page */
      });
    return () => {
      controller.abort();
    };
  }, []);

  return release;
}
