export type {
  BuildPoolInput,
  EvaluateRosterInput,
  FarmContext,
  ForgeAction,
  TeamPlan,
  TeamPlanAccountInput,
  TeamPlanAllowedChanges,
  TeamPlanBlockedResult,
  TeamPlanFarmObjective,
  TeamPlanHeroInput,
  TeamPlanInput,
  TeamPlanObjective,
  TeamPlanOkResult,
  TeamPlanResult,
  GearPool,
  HeroPlanContext,
  HeroScore,
  MoveAction,
  PoolEntry,
  RosterEvaluation,
  RosterRegime,
  ScopeState,
  WaterfallStep,
} from './types';

export { mayMoveGear, mayRespendPoints } from './allowed-changes';
export { COMMIT_INDEX, COMMIT_ORDER, commitVectorEquals, pointsToCommitVector } from './apply-commit-vector';
export {
  deriveEquipUnits,
  liveGearStateFromRows,
  preflightEquipUnits,
  summarizeApplyVerdicts,
  type ApplyVerdictCounts,
  type LiveGearState,
} from './apply-equip';
export { computeRosterAuras } from './auras';
export { AURA_FIXED_POINT_ROUNDS, evaluateRoster } from './evaluate';
export {
  buildHeroPlanContext,
  buildHeroPlanContexts,
  type BuildHeroPlanContextsResult,
  type TeamPlanBlocked,
} from './hero-context';
export {
  buildPool,
  clampForgeFloor,
  effectiveUpgrade,
  eligibleForHero,
  poolEntryForItem,
} from './pool';
export { createScoreMemo, scoreHeroLoadout, type ScoreMemo } from './score';
export {
  TEAM_PLAN_MAX_EVALUATIONS,
  TEAM_PLAN_WORKER_MARKER,
  IMPROVEMENT_EPSILON,
  MAX_ROUNDS,
  runTeamPlan,
} from './solver';
export { buildWaterfall, baselineAssignmentFromInput } from './waterfall';
