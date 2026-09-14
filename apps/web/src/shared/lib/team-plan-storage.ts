import type {
  TeamPlan,
  TeamPlanAllowedChanges,
  TeamPlanObjective,
} from '@bombfarm/domain/team-plan/types';
import { isTeamPlanAllowedChanges, isTeamPlanObjective } from '@bombfarm/team-plan/core';
import { readJson, writeJson } from '@/shared/lib/storage';

export const TEAM_PLAN_KEY = 'bf-hp-team-plan-v1';

export type TeamPlanEnvelope = {
  version: 1;
  signature: string;
  objective: TeamPlanObjective;
  allowedChanges: TeamPlanAllowedChanges;
  ignoreFieldCrowding: boolean;
  targetPhase: number | null;
  plan: TeamPlan;
};

const REQUIRED_PLAN_MEMBERS = [
  'steps',
  'forgeList',
  'moveList',
  'pointResets',
  'perHero',
  'currentDps',
  'planDps',
  'scoredPhaseSource',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWholePlan(value: unknown): value is TeamPlan {
  return isPlainObject(value) && REQUIRED_PLAN_MEMBERS.every((member) => member in value);
}

function isTargetPhase(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isTeamPlanEnvelope(value: unknown): value is TeamPlanEnvelope {
  return (
    isPlainObject(value) &&
    value.version === 1 &&
    typeof value.signature === 'string' &&
    isTeamPlanObjective(value.objective) &&
    isTeamPlanAllowedChanges(value.allowedChanges) &&
    typeof value.ignoreFieldCrowding === 'boolean' &&
    isTargetPhase(value.targetPhase) &&
    isWholePlan(value.plan)
  );
}

export function loadTeamPlanEnvelope(): TeamPlanEnvelope | null {
  const raw = readJson<unknown>(TEAM_PLAN_KEY, null);
  return isTeamPlanEnvelope(raw) ? raw : null;
}

export function saveTeamPlanEnvelope(envelope: TeamPlanEnvelope): boolean {
  return writeJson(TEAM_PLAN_KEY, envelope);
}

export function removeTeamPlanEnvelope(): void {
  localStorage.removeItem(TEAM_PLAN_KEY);
}
