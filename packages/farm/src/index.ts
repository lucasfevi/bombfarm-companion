/**
 * @bombfarm/farm public root.
 * Prefer the named subpaths: `@bombfarm/farm/core`, `@bombfarm/farm/copy`.
 *
 * What surfaces here is the handful of things a host app reaches for OUTSIDE the farm screen —
 * the phase label its own pages print, and the proposal types its own store holds.
 */
export { formatPhaseLabel } from './model/phase-label';
export type { FarmRespecProposal, FarmRespecStatus } from './model/farm-respec-view';
