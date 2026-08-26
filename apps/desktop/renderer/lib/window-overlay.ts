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

    const update = (): void => {
      setInset(overlayInsetFrom(overlay, window.innerWidth));
    };
    update();
    overlay.addEventListener('geometrychange', update);
    return () => {
      overlay.removeEventListener('geometrychange', update);
    };
  }, []);

  return inset;
}
