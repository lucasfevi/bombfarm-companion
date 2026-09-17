/**
 * `@bombfarm/team-plan/core` — presentation-free optimizer logic.
 *
 * A host app maps its own state onto `TeamPlanInputs` and `TeamPlanControls`, owns the
 * controls' storage, and calls the rules here to decide when a plan is stale and which
 * control changes clear it. Nothing here imports React or a store library.
 */
export type { TeamPlanInputs } from './team-plan-inputs';
export type { TeamPlanControls } from './team-plan-controls';
export type { TeamPlanControlChange } from './plan-lifecycle';
export {
  DEFAULT_TEAM_PLAN_OBJECTIVE,
  isTeamPlanObjective,
  DEFAULT_TEAM_PLAN_ALLOWED_CHANGES,
  isTeamPlanAllowedChanges,
  DEFAULT_TEAM_PLAN_FORGE_FLOOR,
  DEFAULT_TEAM_PLAN_CONTROLS,
  isScopeState,
  clampForgeFloor,
  clampTargetPhase,
  isTeamAuraId,
  normalizeAurasAtCap,
  withAuraAtCap,
} from './team-plan-controls';
export type { ScopeState } from './hero-scope';
export {
  defaultScopeForHero,
  resolveHeroScope,
  buildDefaultScopeMap,
  mergeScopeForRoster,
  countOptimizeScopeHeroes,
  heroScopeKey,
} from './hero-scope';
export { buildTeamPlanInput } from './build-team-plan-input';
export {
  resolveTeamPlanTargetPhase,
  isFarmObjectiveUnavailable,
  computeTeamPlanInputSignature,
  isTeamPlanStale,
  applyTeamPlanControlChange,
} from './plan-lifecycle';
export type { TeamPlanRunStatus } from './run-status';
