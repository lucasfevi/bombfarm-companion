/**
 * Runs `callback` after the browser has painted the current frame — double
 * `requestAnimationFrame`, not one: a single `rAF` callback still fires BEFORE the paint it is
 * meant to follow, so a busy state set just before calling this would never actually reach the
 * screen with one frame. Falls back to `setTimeout(callback, 0)` when `requestAnimationFrame` is
 * unavailable (Vitest/Node).
 */
export function scheduleAfterPaint(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(callback));
  } else {
    setTimeout(callback, 0);
  }
}
