/**
 * @bombfarm/farm public root.
 * Prefer the named subpaths: `@bombfarm/farm/core`, `@bombfarm/farm/copy`.
 *
 * What surfaces here is the handful of things a host app reaches for OUTSIDE the farm screen —
 * the phase label its own pages print, and the after-paint scheduler both hosts drive the
 * compute through.
 */
export { formatPhaseLabel } from './model/phase-label';
export { phaseFromSearchValue, phaseSearchOptions, phaseSearchValue } from './model/phase-options';
export { scheduleAfterPaint } from './model/schedule-after-paint';
