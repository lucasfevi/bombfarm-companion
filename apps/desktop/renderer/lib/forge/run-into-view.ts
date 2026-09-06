'use client';

/**
 * How far a scroller must move to bring a band wholly into view: negative when the band starts
 * above the port, positive when it ends below it, and zero when every part of it already shows —
 * a band that is already visible must not move the page at all. A band taller than the port stops
 * at aligning its top rather than scrolling its start off the other edge.
 */
export function scrollDeltaIntoView(
  band: { top: number; bottom: number },
  port: { top: number; bottom: number },
): number {
  if (band.top < port.top) return band.top - port.top;
  if (band.bottom > port.bottom) return Math.min(band.bottom - port.bottom, band.top - port.top);
  return 0;
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Scrolls the shell's `<main>` so a band that has just opened is wholly on screen. The band is
 * measured at the height it is animating *to*, not the height it currently draws: the transition
 * starts from nothing, so a box read on the first frame would call every run fully visible.
 */
export function bringBandIntoView(band: HTMLElement | null, height: number): void {
  const port = band?.closest('main') ?? null;
  if (band === null || port === null) return;
  const bandTop = band.getBoundingClientRect().top;
  const portBox = port.getBoundingClientRect();
  const delta = scrollDeltaIntoView(
    { top: bandTop, bottom: bandTop + height },
    { top: portBox.top, bottom: portBox.bottom },
  );
  if (delta === 0) return;
  port.scrollBy({ top: delta, behavior: reducedMotion() ? 'auto' : 'smooth' });
}
