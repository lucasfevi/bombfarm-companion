import { useEffect } from 'react';

/** The window's bridge to main, where there is one (not in the static export build). */
interface TabRequestBridge {
  on(channel: 'premium:showTab', handler: () => void): () => void;
}

/**
 * Calls `open` when main asks the window to show the Premium tab, such as after the player clicks
 * a Premium notification.
 */
export function usePremiumTabRequest(open: () => void): void {
  useEffect(() => {
    const bridge = (window as unknown as { bfc?: TabRequestBridge }).bfc;
    return bridge?.on('premium:showTab', open);
  }, [open]);
}
