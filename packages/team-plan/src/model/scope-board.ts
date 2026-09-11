import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { resolveHeroScope, type ScopeState } from '../core/hero-scope';
import { isScopeState } from '../core/team-plan-controls';

export { isScopeState };

export const SCOPE_COLUMNS: readonly ScopeState[] = ['optimize', 'donate', 'leaveAlone'];

/** Prefer the column/card the drop landed on; fall back to the hero row it landed on. */
export function resolveDropScope(
  overId: string,
  overData: unknown,
  scopeByHeroId: Record<string, ScopeState>,
): ScopeState | null {
  if (overData && typeof overData === 'object') {
    const data = overData as { type?: unknown; scope?: unknown };
    if (data.type === 'column' && typeof data.scope === 'string' && isScopeState(data.scope)) {
      return data.scope;
    }
    if (data.type === 'hero' && typeof data.scope === 'string' && isScopeState(data.scope)) {
      return data.scope;
    }
  }
  if (isScopeState(overId)) return overId;
  return scopeByHeroId[overId] ?? null;
}

export function groupHeroesByScope(
  heroes: readonly HeroRecord[],
  scopeByHeroId: Record<string, ScopeState>,
): { resolved: Record<string, ScopeState>; byColumn: Record<ScopeState, HeroRecord[]> } {
  const resolved: Record<string, ScopeState> = {};
  for (const hero of heroes) {
    resolved[hero.id] = resolveHeroScope(hero, scopeByHeroId);
  }

  const byColumn: Record<ScopeState, HeroRecord[]> = { optimize: [], donate: [], leaveAlone: [] };
  for (const hero of heroes) {
    byColumn[resolved[hero.id] ?? 'optimize'].push(hero);
  }

  return { resolved, byColumn };
}
