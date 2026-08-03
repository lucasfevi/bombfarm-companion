'use client';

import { useEffect } from 'react';
import MicrosoftClarity from '@microsoft/clarity';

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

/**
 * Microsoft Clarity via `@microsoft/clarity`.
 * Initializes only when NEXT_PUBLIC_CLARITY_ID is set, and only after the
 * browser is idle so analytics never compete with planner paint/interaction.
 */
export function ClarityAnalytics() {
  useEffect(() => {
    if (!CLARITY_ID) return;

    let cancelled = false;
    const start = () => {
      if (!cancelled) MicrosoftClarity.init(CLARITY_ID);
    };

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(start, { timeout: 4000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(start, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
