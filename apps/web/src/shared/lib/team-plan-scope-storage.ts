import type { ScopeState } from '@bombfarm/domain/team-plan/types';
import { readJson, writeJson } from '@/shared/lib/storage';

export const TEAM_PLAN_SCOPE_KEY = 'bf-hp-gear-scope-v2';
export const LEGACY_TEAM_PLAN_SCOPE_KEY = 'bf-hp-gear-scope-v1';

function isScopeState(value: unknown): value is ScopeState {
  return value === 'optimize' || value === 'donate' || value === 'leaveAlone';
}

function readScopeMap(key: string): Record<string, ScopeState> | null {
  const raw = readJson<Record<string, unknown> | null>(key, null);
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, ScopeState> = {};
  for (const [heroId, value] of Object.entries(raw)) {
    if (isScopeState(value)) out[heroId] = value;
  }
  return out;
}

/** The v1 map saved every hero's default as if chosen; it is read once, cleaned against the
 *  roster by the caller, and rewritten under the v2 key by {@link saveTeamPlanScope}. */
export function loadTeamPlanScope(): { scopeByHeroId: Record<string, ScopeState>; fromLegacy: boolean } {
  const current = readScopeMap(TEAM_PLAN_SCOPE_KEY);
  if (current) return { scopeByHeroId: current, fromLegacy: false };
  const legacy = readScopeMap(LEGACY_TEAM_PLAN_SCOPE_KEY);
  return { scopeByHeroId: legacy ?? {}, fromLegacy: legacy !== null };
}

export function saveTeamPlanScope(scopeByHeroId: Record<string, ScopeState>): boolean {
  return writeJson(TEAM_PLAN_SCOPE_KEY, scopeByHeroId);
}

export function removeLegacyTeamPlanScope(): void {
  try {
    localStorage.removeItem(LEGACY_TEAM_PLAN_SCOPE_KEY);
  } catch {
    // A leftover legacy key is ignored once the v2 key exists.
  }
}
