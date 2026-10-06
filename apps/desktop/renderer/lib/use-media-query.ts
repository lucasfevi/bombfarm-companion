import { useSyncExternalStore } from 'react';

function matcher(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query);
}

/** Whether a media query holds right now, and again whenever it flips. `false` where there is no
 *  window to ask, so a static render and the first paint agree. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = matcher(query);
      list?.addEventListener('change', notify);
      return () => {
        list?.removeEventListener('change', notify);
      };
    },
    () => matcher(query)?.matches ?? false,
    () => false,
  );
}
