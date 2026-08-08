import type { ScopeState } from '@bombfarm/domain/team-plan/types';
import { readJson, writeJson } from '@/shared/lib/storage';

export const TEAM_PLAN_SCOPE_KEY = 'bf-hp-gear-scope-v1';

function isScopeState(value: unknown): value is ScopeState {
  return value === 'optimize' || value === 'donate' || value === 'leaveAlone';
}

export function loadTeamPlanScope(): Record<string, ScopeState> {
  const raw = readJson<Record<string, unknown> | null>(TEAM_PLAN_SCOPE_KEY, null);
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, ScopeState> = {};
  for (const [heroId, value] of Object.entries(raw)) {
    if (isScopeState(value)) out[heroId] = value;
  }
  return out;
}

export function saveTeamPlanScope(scopeByHeroId: Record<string, ScopeState>): boolean {
  return writeJson(TEAM_PLAN_SCOPE_KEY, scopeByHeroId);
}
