import { useEffect, useState } from 'react';
import { useAccountView } from '../account/use-account-view';
import { formatPassRemaining, readVipUntil } from './pass-countdown';

const TICK_MS = 30_000;

/** `null` while the Pass is not active, so the strip draws nothing for it. */
export function usePassCountdown(): string | null {
  const state = useAccountView();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return formatPassRemaining(readVipUntil(state.status === 'loaded' ? state.view : null), nowMs);
}
