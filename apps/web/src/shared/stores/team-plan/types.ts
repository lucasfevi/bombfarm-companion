import type { InventoryItem, InventorySnapshot } from '@bombfarm/domain/inventory';
import type { TeamPlan as DomainTeamPlan } from '@bombfarm/domain/team-plan/types';

export type {
  ScopeState,
  TeamPlanRunStatus,
} from '@bombfarm/team-plan/core';
export {
  DEFAULT_TEAM_PLAN_OBJECTIVE,
  isTeamPlanObjective,
  DEFAULT_TEAM_PLAN_ALLOWED_CHANGES,
  isTeamPlanAllowedChanges,
  clampForgeFloor,
  defaultScopeForHero,
  resolveHeroScope,
  buildDefaultScopeMap,
  mergeScopeForRoster,
  computeTeamPlanInputSignature,
} from '@bombfarm/team-plan/core';

export type TeamPlan = DomainTeamPlan | null;

export type { InventoryItem, InventorySnapshot };
