/**
 * `@bombfarm/team-plan/model` — the view judgements the components render from, each testable
 * without a rendering harness.
 */
export {
  buildGearFlowRows,
  groupGearFlowRows,
  removedRowsByOriginHero,
  isKeptExistingGearFlowRow,
} from './gear-flow-rows';
export type { GearFlowRow, GearFlowGroup } from './gear-flow-rows';
export { pointsResetView } from './points-reset-view';
export type { PointsResetView } from './points-reset-view';
export { withExpectedForge } from './proposed-gear-forecast';
export { buildForgeQueue, forgeLadderRungs, type ForgeQueue, type ForgeQueueEntry, type ForgeLadderRung } from './forge-queue';
export { HERO6_BOMB_ACTIVATION_FRAME_MS, HERO6_BOMB_ACTIVATION_FRAMES } from './hero6-bomb-activation';
export { teamPlanPhaseOptions, phaseOptionValue, phaseFromOptionValue, TEAM_PLAN_PHASE_NONE } from './phase-options';
export { teamPlanObjectiveCopy } from './objective-copy';
export type { TeamPlanObjectiveCopy } from './objective-copy';
export { teamPlanEmptyState } from './empty-state';
export type { TeamPlanEmptyStateKind } from './empty-state';
export { isScopeState, SCOPE_COLUMNS, resolveDropScope, groupHeroesByScope } from './scope-board';
export {
  scoredPhaseHint,
  scoredPhaseMovedFrom,
  scoredPhaseValue,
  seedStartLabel,
  formatElapsedSeconds,
} from './run-summary-copy';
export { optimizeAriaFor, allowedChangesHint, ignoreCrowdingHint } from './setup-copy';
export { formatElapsed } from './optimizing-elapsed';
