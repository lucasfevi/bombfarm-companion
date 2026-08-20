export type {
  BuildPoolInput,
  EvaluateRosterInput,
  FarmContext,
  ForgeAction,
  TeamPlan,
  TeamPlanAccountInput,
  TeamPlanBlockedResult,
  TeamPlanHeroInput,
  TeamPlanInput,
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

export { PASSAGEM_BASTAO_WINDOW_SEC, passagemBastaoMult, unmodelledAbilitiesInScope } from './ability-extras';
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
