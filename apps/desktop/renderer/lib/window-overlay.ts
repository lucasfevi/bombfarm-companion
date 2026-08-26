import { useEffect, useState } from 'react';

export interface TitlebarAreaRect {
  right: number;
}

export interface WindowControlsOverlayLike {
  visible: boolean;
  getTitlebarAreaRect: () => TitlebarAreaRect;
}

/** Width (px) the OS caption buttons reserve on the right edge — 0 when the overlay API is
 *  absent (non-Windows) or not yet visible, so callers fall back to an uninset header. */
export function overlayInsetFrom(overlay: WindowControlsOverlayLike | undefined, innerWidth: number): number {
  if (!overlay?.visible) return 0;
  return Math.max(0, innerWidth - overlay.getTitlebarAreaRect().right);
}

/** Tracks the live overlay inset. `navigator.windowControlsOverlay` only exists once the page has
 *  mounted in a browser context (the static export also prerenders with no `window` at all), so
 *  this reads it from an effect and starts at 0 for that first render either way. */
export function useOverlayInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const overlay = navigator.windowControlsOverlay;
    if (!overlay) return;

    // Both events fire mid-transition while maximizing, and the overlay reports itself invisible
    // for part of that — reading it right then yields a zero inset that no later event corrects.
    // Reading on the next frame instead lets the window settle before it is measured.
    let frame = 0;
    const update = (): void => {
      setInset(overlayInsetFrom(overlay, window.innerWidth));
    };
    const schedule = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    overlay.addEventListener('geometrychange', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      overlay.removeEventListener('geometrychange', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return inset;
}
