'use client';

import { useEffect, useState } from 'react';

const TICK_MS = 100;

/**
 * Seconds into a loop of `periodSeconds`, restarting at the end.
 *
 * Starts at 0 and only begins ticking after mount, so the server-rendered markup and the first
 * client render agree. Readers who ask for reduced motion keep frame 0 forever — every drawing
 * driven by this stays complete and readable, it just does not move.
 */
export function useLoopClock(periodSeconds: number): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const startedAt = performance.now();
    const timer = setInterval(() => {
      setElapsed(((performance.now() - startedAt) / 1000) % periodSeconds);
    }, TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, [periodSeconds]);

  return elapsed;
}
