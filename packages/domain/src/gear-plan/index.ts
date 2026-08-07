export type {
  BuildPoolInput,
  EvaluateRosterInput,
  FarmContext,
  ForgeAction,
  GearPlan,
  GearPlanAccountInput,
  GearPlanBlockedResult,
  GearPlanHeroInput,
  GearPlanInput,
  GearPlanOkResult,
  GearPlanResult,
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
  type GearPlanBlocked,
} from './hero-context';
export {
  buildPool,
  clampForgeFloor,
  effectiveUpgrade,
  eligibleForHero,
} from './pool';
export { createScoreMemo, scoreHeroLoadout, type ScoreMemo } from './score';
export {
  GEAR_PLAN_MAX_EVALUATIONS,
  GEAR_PLAN_WORKER_MARKER,
  IMPROVEMENT_EPSILON,
  MAX_ROUNDS,
  runGearPlan,
} from './solver';
export { buildWaterfall, baselineAssignmentFromInput } from './waterfall';
