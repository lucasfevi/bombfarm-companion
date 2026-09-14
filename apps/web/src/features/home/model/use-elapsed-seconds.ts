'use client';

import { useEffect, useState } from 'react';

export function elapsedWholeSeconds(startedAt: number, now: number): number {
  return Math.floor((now - startedAt) / 1000);
}

export function useElapsedSeconds(runId: string | null, running: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running || runId == null) return;
    const startedAt = performance.now();
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds(elapsedWholeSeconds(startedAt, performance.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [runId, running]);

  return seconds;
}
